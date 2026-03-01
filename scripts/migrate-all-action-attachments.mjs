#!/usr/bin/env node
/**
 * Batch migrate all action attachments from mission-attachments/ to organizations/{org_id}/images/
 * 
 * This script:
 * 1. Queries all actions with mission-attachments attachments
 * 2. For each action:
 *    - Migrates all attachment files to organizations/{org_id}/images/
 *    - Generates thumbnails
 *    - Updates database with new paths
 * 3. Handles both full URLs and S3 keys
 * 4. Processes in batches with progress tracking
 * 
 * Usage:
 *   node scripts/migrate-all-action-attachments.mjs [--dry-run] [--limit N] [--skip N]
 * 
 * Examples:
 *   node scripts/migrate-all-action-attachments.mjs --dry-run --limit 5
 *   node scripts/migrate-all-action-attachments.mjs --limit 10
 *   node scripts/migrate-all-action-attachments.mjs
 */

import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

const s3Client = new S3Client({ region: 'us-west-2' });
const BUCKET = 'cwf-dev-assets';
const S3_BUCKET_URL = `https://${BUCKET}.s3.us-west-2.amazonaws.com`;

// Parse args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;
const skipIndex = args.indexOf('--skip');
const skip = skipIndex !== -1 ? parseInt(args[skipIndex + 1]) : 0;

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fileExists(key) {
  try {
    // Try HTTP HEAD request instead of S3 SDK to avoid credential issues
    const url = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${key}`;
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null;
  
  // If it's a full URL, extract the key
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey.replace(`${S3_BUCKET_URL}/`, '').replace(/^https?:\/\/[^\/]+\//, '');
  }
  
  return urlOrKey;
}

async function queryActionsWithLegacyAttachments(limit, skip) {
  console.log('📋 Querying actions with legacy attachments...');
  
  const sql = `SELECT id, organization_id, title, attachments FROM actions WHERE attachments::text LIKE '%mission-attachments%' ORDER BY created_at DESC${limit ? ` LIMIT ${limit}` : ''}${skip ? ` OFFSET ${skip}` : ''};`;
  
  const payload = { sql };
  
  // Use unique filenames to avoid conflicts
  const timestamp = Date.now();
  const payloadFile = `/tmp/query-payload-${timestamp}.json`;
  const responseFile = `/tmp/query-response-${timestamp}.json`;
  
  // Write to temp file to avoid shell escaping issues
  const fs = await import('fs');
  fs.writeFileSync(payloadFile, JSON.stringify(payload));
  
  // Run Lambda invoke (don't use && cat, just read file after)
  const command = `cat ${payloadFile} | aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out ${responseFile}`;
  
  try {
    execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    
    // Read response file
    const output = fs.readFileSync(responseFile, 'utf-8');
    const response = JSON.parse(output);
    
    // Handle nested body structure
    let body;
    if (response.body) {
      body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } else {
      body = response;
    }
    
    // Cleanup temp files
    fs.unlinkSync(payloadFile);
    fs.unlinkSync(responseFile);
    
    return body.rows || [];
  } catch (error) {
    // Cleanup temp files
    try { fs.unlinkSync(payloadFile); } catch (e) {}
    try { fs.unlinkSync(responseFile); } catch (e) {}
    throw error;
  }
}

async function updateActionAttachments(actionId, newAttachments) {
  // Convert array to PostgreSQL array literal
  const arrayLiteral = `ARRAY[${newAttachments.map(a => `'${a.replace(/'/g, "''")}'`).join(',')}]::text[]`;
  
  const sql = `UPDATE actions SET attachments = ${arrayLiteral}, updated_at = NOW() WHERE id = '${actionId}' RETURNING id, attachments;`;
  
  const payload = { sql };
  
  // Write to temp file to avoid shell escaping issues
  const fs = await import('fs');
  fs.writeFileSync('/tmp/update-payload.json', JSON.stringify(payload));
  
  const command = `cat /tmp/update-payload.json | aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out /tmp/update-response.json && cat /tmp/update-response.json`;
  
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const response = JSON.parse(output);
    
    // Handle nested body structure
    let body;
    if (response.body) {
      body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } else {
      body = response;
    }
    
    return body.rows[0];
  } catch (error) {
    // If command fails, try reading the response file directly
    const fs = await import('fs');
    if (fs.existsSync('/tmp/update-response.json')) {
      const output = fs.readFileSync('/tmp/update-response.json', 'utf-8');
      const response = JSON.parse(output);
      let body;
      if (response.body) {
        body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      } else {
        body = response;
      }
      return body.rows[0];
    }
    throw error;
  }
}

async function migrateFile(oldKey, orgId) {
  // Extract filename
  const filename = oldKey.split('/').pop();
  const newKey = `organizations/${orgId}/images/${filename}`;
  const thumbnailKey = newKey
    .replace(/\/images\//, '/images/thumb/')
    .replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  // Check if files already exist
  const newExists = await fileExists(newKey);
  const thumbExists = await fileExists(thumbnailKey);
  
  if (newExists && thumbExists) {
    return { 
      success: true, 
      skipped: true, 
      newKey, 
      thumbnailKey,
      reason: 'already exists' 
    };
  }
  
  // Check if old file exists
  const oldExists = await fileExists(oldKey);
  if (!oldExists) {
    return { 
      success: false, 
      error: 'Old file not found',
      oldKey 
    };
  }
  
  if (isDryRun) {
    return { 
      success: true, 
      dryRun: true, 
      newKey, 
      thumbnailKey 
    };
  }
  
  try {
    // Download original via HTTP (mission-attachments has explicit deny for S3 SDK)
    const url = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${oldKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}`,
        oldKey 
      };
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const originalSize = imageBuffer.length;
    
    // Compress with metadata stripped
    const compressed = await sharp(imageBuffer)
      .rotate()
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .withMetadata(false)
      .toBuffer();
    
    const compressedSize = compressed.length;
    
    // Upload compressed (only if doesn't exist)
    if (!newExists) {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: newKey,
        Body: compressed,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000',
      }));
    }
    
    // Generate and upload thumbnail (only if doesn't exist)
    if (!thumbExists) {
      const thumbnail = await sharp(imageBuffer)
        .rotate()
        .resize(150, 150, { fit: 'cover' })
        .webp({ quality: 60 })
        .withMetadata(false)
        .toBuffer();
      
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      }));
    }
    
    return { 
      success: true, 
      newKey, 
      thumbnailKey,
      originalSize,
      compressedSize
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      oldKey 
    };
  }
}

async function migrateAction(action, actionIndex, totalActions) {
  console.log(`\n[${ actionIndex + 1}/${totalActions}] ${action.title}`);
  console.log(`   ID: ${action.id}`);
  console.log(`   Org: ${action.organization_id}`);
  
  // Parse attachments (handle both array and string)
  let attachments = action.attachments;
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch (e) {
      console.log(`   ❌ Failed to parse attachments: ${e.message}`);
      return { success: false, error: 'Failed to parse attachments' };
    }
  }
  
  if (!Array.isArray(attachments) || attachments.length === 0) {
    console.log(`   ⚠️  No attachments found`);
    return { success: false, error: 'No attachments' };
  }
  
  // Filter to only legacy attachments
  const legacyAttachments = attachments.filter(a => {
    const key = extractS3Key(a);
    return key && key.includes('mission-attachments');
  });
  
  if (legacyAttachments.length === 0) {
    console.log(`   ⚠️  No legacy attachments found`);
    return { success: false, error: 'No legacy attachments' };
  }
  
  console.log(`   📦 ${legacyAttachments.length} file(s) to migrate`);
  
  // Migrate each file
  const results = [];
  const newAttachments = [...attachments];
  
  for (let i = 0; i < legacyAttachments.length; i++) {
    const oldUrlOrKey = legacyAttachments[i];
    const oldKey = extractS3Key(oldUrlOrKey);
    
    if (!oldKey) {
      console.log(`   ⚠️  [${i + 1}/${legacyAttachments.length}] Invalid key: ${oldUrlOrKey}`);
      results.push({ success: false, error: 'Invalid key' });
      continue;
    }
    
    process.stdout.write(`   🔄 [${i + 1}/${legacyAttachments.length}] ${oldKey.split('/').pop()}...`);
    
    const result = await migrateFile(oldKey, action.organization_id);
    results.push(result);
    
    if (result.success) {
      if (result.skipped) {
        console.log(` ⏭️  skipped (${result.reason})`);
      } else if (result.dryRun) {
        console.log(` [DRY RUN]`);
      } else {
        const reduction = result.originalSize && result.compressedSize 
          ? ((1 - result.compressedSize / result.originalSize) * 100).toFixed(0)
          : '?';
        console.log(` ✅ (${reduction}% reduction)`);
      }
      
      // Replace old path with new path in attachments array
      if (!result.dryRun && result.newKey) {
        const index = newAttachments.indexOf(oldUrlOrKey);
        if (index !== -1) {
          newAttachments[index] = result.newKey;
        }
      }
    } else {
      console.log(` ❌ ${result.error}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Update database if all migrations succeeded
  const allSucceeded = results.every(r => r.success);
  const anyMigrated = results.some(r => r.success && !r.dryRun && !r.skipped);
  
  if (allSucceeded && anyMigrated && !isDryRun) {
    try {
      console.log(`   💾 Updating database...`);
      await updateActionAttachments(action.id, newAttachments);
      console.log(`   ✅ Database updated`);
    } catch (error) {
      console.log(`   ❌ Database update failed: ${error.message}`);
      return { 
        success: false, 
        error: 'Database update failed',
        filesSucceeded: results.filter(r => r.success).length,
        filesFailed: results.filter(r => !r.success).length
      };
    }
  }
  
  return {
    success: allSucceeded,
    filesSucceeded: results.filter(r => r.success).length,
    filesFailed: results.filter(r => !r.success).length,
    filesSkipped: results.filter(r => r.skipped).length,
    totalFiles: results.length
  };
}

async function main() {
  console.log('🔄 Batch Action Attachment Migration');
  console.log('='.repeat(70));
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Skip: ${skip}`);
  console.log('');
  
  try {
    // Query actions
    const actions = await queryActionsWithLegacyAttachments(limit, skip);
    
    if (actions.length === 0) {
      console.log('✅ No actions with legacy attachments found');
      return;
    }
    
    console.log(`Found ${actions.length} action(s) to process`);
    
    // Process each action
    const stats = {
      actionsProcessed: 0,
      actionsSucceeded: 0,
      actionsFailed: 0,
      filesSucceeded: 0,
      filesFailed: 0,
      filesSkipped: 0,
      totalFiles: 0
    };
    
    for (let i = 0; i < actions.length; i++) {
      const result = await migrateAction(actions[i], i, actions.length);
      
      stats.actionsProcessed++;
      if (result.success) {
        stats.actionsSucceeded++;
      } else {
        stats.actionsFailed++;
      }
      
      stats.filesSucceeded += result.filesSucceeded || 0;
      stats.filesFailed += result.filesFailed || 0;
      stats.filesSkipped += result.filesSkipped || 0;
      stats.totalFiles += result.totalFiles || 0;
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Summary');
    console.log('='.repeat(70));
    console.log(`Actions processed: ${stats.actionsProcessed}`);
    console.log(`  ✅ Succeeded: ${stats.actionsSucceeded}`);
    console.log(`  ❌ Failed: ${stats.actionsFailed}`);
    console.log('');
    console.log(`Files processed: ${stats.totalFiles}`);
    console.log(`  ✅ Migrated: ${stats.filesSucceeded}`);
    console.log(`  ⏭️  Skipped: ${stats.filesSkipped}`);
    console.log(`  ❌ Failed: ${stats.filesFailed}`);
    
    if (isDryRun) {
      console.log('');
      console.log('ℹ️  This was a dry run. Run without --dry-run to perform migration.');
    } else if (stats.actionsSucceeded > 0) {
      console.log('');
      console.log('✅ Migration complete!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Test a few actions in the UI to verify images load correctly');
      console.log('2. If all good, run again without --limit to process remaining actions');
      console.log('3. After full migration, simplify getThumbnailUrl() to remove mission-attachments handling');
      console.log('4. After verification period, delete old mission-attachments/ files');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
