#!/usr/bin/env node
/**
 * Migrate Google Photos links from state_text to S3 + state_photos.
 *
 * This script:
 * 1. Queries all states with {{photo:https://photos.app.goo.gl/...}} in state_text
 * 2. Opens each Google Photos link in a Puppeteer browser (using your Chrome profile)
 * 3. Downloads the full-resolution image
 * 4. Uploads to S3 via the presigned upload Lambda
 * 5. Inserts into state_photos
 * 6. Strips the {{photo:...}} tag from state_text
 *
 * Prerequisites:
 *   npm install puppeteer
 *
 * Usage:
 *   # Dry run (just list what would be migrated):
 *   node migrations/migrate-google-photos.js --dry-run
 *
 *   # Actually migrate:
 *   node migrations/migrate-google-photos.js
 *
 *   # Migrate with custom Chrome profile:
 *   node migrations/migrate-google-photos.js --chrome-profile="/home/stefan/.config/google-chrome"
 *
 *   # Limit to N photos (for testing):
 *   node migrations/migrate-google-photos.js --limit=5
 */

const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const limitArg = args.find(a => a.startsWith('--limit='));
  return limitArg ? parseInt(limitArg.split('=')[1]) : null;
})();
const CHROME_PROFILE = (() => {
  const profileArg = args.find(a => a.startsWith('--chrome-profile='));
  if (profileArg) return profileArg.split('=')[1];
  // Default Chrome profile paths
  if (process.platform === 'linux') return path.join(os.homedir(), '.config/google-chrome');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  return null;
})();

// Load env
// Load env - parse .env.local manually to handle special chars in passwords
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    const value = trimmed.substring(eqIdx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const S3_BUCKET = 'cwf-dev-assets';
const S3_REGION = 'us-west-2';
const S3_PREFIX = 'financial-receipts';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const s3 = new S3Client({ region: S3_REGION });

// Prevent unhandled pool errors from crashing the process
pool.on('error', (err) => console.error('Pool error (non-fatal):', err.message));


/**
 * Extract all {{photo:URL}} tags from state_text
 */
function extractPhotoUrls(stateText) {
  const regex = /\{\{photo:(https?:\/\/[^}]+)\}\}/g;
  const urls = [];
  let match;
  while ((match = regex.exec(stateText)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/**
 * Strip {{photo:URL}} tags from state_text
 */
function stripPhotoTags(stateText) {
  return stateText.replace(/\s*\{\{photo:https?:\/\/[^}]+\}\}/g, '').trim();
}

/**
 * Download image from Google Photos using Puppeteer
 */
async function downloadFromGooglePhotos(browser, url, timeoutMs = 30000) {
  const page = await browser.newPage();
  try {
    // Navigate to the sharing link
    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

    // Try multiple selectors — Google Photos uses different layouts
    const selectors = [
      'img[src*="googleusercontent"]',
      'img[src*="lh3.google"]',
      'img[src*="lh4.google"]',
      'img[src*="lh5.google"]',
      'img[data-src*="googleusercontent"]',
      // Album view uses different selectors
      '[data-latest-bg*="googleusercontent"]',
    ];

    // Wait for any image to appear, with retries
    let found = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const sel of selectors) {
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          found = true;
          break;
        } catch { /* try next */ }
      }
      if (found) break;
      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 500));
      await new Promise(r => setTimeout(r, 2000));
    }

    // Get ALL unique image URLs from the page
    const imgUrls = await page.evaluate(() => {
      const seen = new Set();
      const urls = [];

      // Check regular img tags
      const imgs = Array.from(document.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.src || img.dataset.src || '';
        if (!src.includes('googleusercontent') && !src.includes('lh3.google') && !src.includes('lh4.google') && !src.includes('lh5.google')) continue;
        if (img.naturalWidth < 50 && img.naturalHeight < 50 && img.width < 50) continue;
        const baseUrl = src.replace(/=w\d+.*$/, '').replace(/=s\d+.*$/, '');
        if (seen.has(baseUrl)) continue;
        seen.add(baseUrl);
        let fullSrc = src.replace(/=w\d+-h\d+[^&]*/, '=w0-h0').replace(/=s\d+[^&]*/, '=s0');
        if (!fullSrc.includes('=w0') && !fullSrc.includes('=s0')) fullSrc += '=w0-h0';
        urls.push(fullSrc);
      }

      // Check background images (album tiles)
      const bgEls = document.querySelectorAll('[style*="googleusercontent"], [data-latest-bg]');
      for (const el of bgEls) {
        const bgMatch = (el.style.backgroundImage || '').match(/url\("?([^"]+)"?\)/);
        const src = bgMatch ? bgMatch[1] : el.dataset.latestBg || '';
        if (!src) continue;
        const baseUrl = src.replace(/=w\d+.*$/, '').replace(/=s\d+.*$/, '');
        if (seen.has(baseUrl)) continue;
        seen.add(baseUrl);
        let fullSrc = src.replace(/=w\d+-h\d+[^&]*/, '=w0-h0').replace(/=s\d+[^&]*/, '=s0');
        if (!fullSrc.includes('=w0') && !fullSrc.includes('=s0')) fullSrc += '=w0-h0';
        urls.push(fullSrc);
      }

      return urls;
    });

    if (imgUrls.length === 0) {
      // Last resort: take a screenshot for debugging
      const debugPath = `/tmp/gphotos-debug-${Date.now()}.png`;
      await page.screenshot({ path: debugPath, fullPage: true });
      throw new Error(`Could not find any images on page (screenshot saved: ${debugPath})`);
    }

    // Download all images
    const results = [];
    for (const imgUrl of imgUrls) {
      const result = await page.evaluate(async (imageUrl) => {
        const resp = await fetch(imageUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        return { bytes, contentType: resp.headers.get('content-type') || 'image/jpeg' };
      }, imgUrl);

      results.push({
        buffer: Buffer.from(result.bytes),
        contentType: result.contentType,
      });
    }

    return results;
  } finally {
    await page.close();
  }
}

/**
 * Upload buffer to S3 with retry
 */
async function uploadToS3(buffer, contentType, retries = 3) {
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const key = `${S3_PREFIX}/${crypto.randomUUID()}.${ext}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      return key;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  ⚠️  S3 upload attempt ${attempt} failed (${err.code || err.message}), retrying in ${attempt * 2}s...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
}


async function main() {
  console.log('🔍 Querying states with Google Photos links...');

  const query = `
    SELECT s.id AS state_id, s.state_text, s.organization_id
    FROM states s
    WHERE s.state_text LIKE '%{{photo:https://photos.app.goo.gl/%'
    ORDER BY s.created_at DESC
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `;

  const result = await pool.query(query);
  const states = result.rows;

  console.log(`Found ${states.length} states with Google Photos links`);

  if (states.length === 0) {
    console.log('Nothing to migrate.');
    await pool.end();
    return;
  }

  // Count total photos
  let totalPhotos = 0;
  for (const state of states) {
    totalPhotos += extractPhotoUrls(state.state_text).length;
  }
  console.log(`Total photos to download: ${totalPhotos}`);

  if (DRY_RUN) {
    console.log('\n--- DRY RUN ---');
    for (const state of states) {
      const urls = extractPhotoUrls(state.state_text);
      console.log(`\nState ${state.state_id}:`);
      urls.forEach(url => console.log(`  📷 ${url}`));
      console.log(`  Text after: "${stripPhotoTags(state.state_text).substring(0, 80)}..."`);
    }
    console.log(`\nWould migrate ${totalPhotos} photos from ${states.length} states.`);
    await pool.end();
    return;
  }

  // Launch browser with user's Chrome profile for Google auth
  console.log('\n🌐 Launching browser...');
  const launchOptions = {
    headless: false, // Need visible browser for Google auth cookies
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  if (CHROME_PROFILE) {
    console.log(`Using Chrome profile: ${CHROME_PROFILE}`);
    launchOptions.args.push(`--user-data-dir=${CHROME_PROFILE}`);
    // Use a separate profile directory to avoid locking the main Chrome
    launchOptions.args.push('--profile-directory=Default');
  } else {
    console.log('⚠️  No Chrome profile specified. You may need to log into Google manually.');
    console.log('   Use --chrome-profile="/path/to/chrome/profile" to use your existing session.');
  }

  const browser = await puppeteer.launch(launchOptions);

  let migrated = 0;
  let failed = 0;
  const errors = [];

  try {
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      const urls = extractPhotoUrls(state.state_text);

      console.log(`\n[${i + 1}/${states.length}] State ${state.state_id} — ${urls.length} photo(s)`);

      // Check existing state_photos count for ordering
      const existingPhotos = await pool.query(
        'SELECT COUNT(*)::int AS count FROM state_photos WHERE state_id = $1',
        [state.state_id]
      );
      let photoOrder = existingPhotos.rows[0].count;

      let allSucceeded = true;
      const successfulUrls = [];

      for (const url of urls) {
        try {
          // Check if this specific URL was already migrated by looking for the
          // Google Photos URL stored as a marker in photo_description
          const existingCheck = await pool.query(
            "SELECT COUNT(*)::int AS count FROM state_photos WHERE state_id = $1 AND photo_description = $2",
            [state.state_id, `migrated:${url}`]
          );
          if (existingCheck.rows[0].count > 0) {
            console.log(`  ⏭️  Already migrated: ${url}`);
            successfulUrls.push(url);
            migrated++;
            continue;
          }

          console.log(`  📥 Downloading: ${url}`);
          const images = await downloadFromGooglePhotos(browser, url);
          console.log(`  📦 Found ${images.length} image(s)`);

          for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
            const { buffer, contentType } = images[imgIdx];
            console.log(`  ☁️  Uploading image ${imgIdx + 1}/${images.length} (${(buffer.length / 1024).toFixed(0)}KB)...`);
            const s3Key = await uploadToS3(buffer, contentType);
            console.log(`  ✅ Uploaded: ${s3Key}`);

            // Insert into state_photos with source URL as marker for idempotency
            await pool.query(
              'INSERT INTO state_photos (state_id, photo_url, photo_description, photo_order) VALUES ($1, $2, $3, $4)',
              [state.state_id, s3Key, imgIdx === 0 ? `migrated:${url}` : null, photoOrder++]
            );
            migrated++;
          }

          successfulUrls.push(url);
          console.log(`  ✅ Saved ${images.length} photo(s) to state_photos`);

          // Small delay to be nice to Google
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.error(`  ❌ Failed: ${err.message}`);
          errors.push({ stateId: state.state_id, url, error: err.message });
          failed++;
          allSucceeded = false;
        }
      }

      // Strip successfully migrated photo tags from state_text
      if (successfulUrls.length > 0) {
        let updatedText = state.state_text;
        for (const url of successfulUrls) {
          updatedText = updatedText.replace(new RegExp(`\\s*\\{\\{photo:${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`, 'g'), '');
        }
        updatedText = updatedText.trim();

        await pool.query(
          'UPDATE states SET state_text = $1, updated_at = NOW() WHERE id = $2',
          [updatedText, state.state_id]
        );
        console.log(`  📝 Updated state_text (stripped ${successfulUrls.length} photo tag(s))`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Migration complete:`);
  console.log(`  ✅ Migrated: ${migrated} photos`);
  console.log(`  ❌ Failed: ${failed} photos`);
  if (errors.length > 0) {
    console.log(`\nFailed downloads:`);
    errors.forEach(e => console.log(`  State ${e.stateId}: ${e.url} — ${e.error}`));
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
