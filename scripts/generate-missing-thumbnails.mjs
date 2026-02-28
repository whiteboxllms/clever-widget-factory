#!/usr/bin/env node
/**
 * Generate missing thumbnails and recompress images with metadata stripped
 * 
 * This script:
 * 1. Lists all images in organizations/{org_id}/images/ (excluding /uploads/ and /thumb/)
 * 2. For each image without a thumbnail:
 *    - Generates compressed version with metadata stripped
 *    - Generates 150x150 WebP thumbnail with metadata stripped
 * 3. Uploads both to S3
 * 
 * Usage: 
 *   node scripts/generate-missing-thumbnails.mjs [--dry-run] [--limit N] [--org-id ORG_ID] [--file FILENAME]
 *   
 * Examples:
 *   node scripts/generate-missing-thumbnails.mjs --file mg510ck86i
 *   node scripts/generate-missing-thumbnails.mjs --limit 5
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'us-west-2' });
const BUCKET = 'cwf-dev-assets';

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;
const orgIdIndex = args.indexOf('--org-id');
const specificOrgId = orgIdIndex !== -1 ? args[orgIdIndex + 1] : null;
const fileIndex = args.indexOf('--file');
const specificFile = fileIndex !== -1 ? args[fileIndex + 1] : null;

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function thumbnailExists(thumbnailKey) {
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: thumbnailKey }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function generateThumbnail(key) {
  try {
    // Generate thumbnail key
    const thumbnailKey = key
      .replace(/\/images\//, '/images/thumb/')
      .replace(/\.(jpg|jpeg|png)$/i, '.webp');
    
    // Check if thumbnail already exists
    if (await thumbnailExists(thumbnailKey)) {
      console.log(`  ⏭️  Thumbnail already exists: ${thumbnailKey}`);
      return { skipped: true, reason: 'exists' };
    }
    
    console.log(`  📥 Downloading: ${key}`);
    
    // Download original
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(getCommand);
    const imageBuffer = await streamToBuffer(response.Body);
    
    const originalSize = imageBuffer.length;
    console.log(`  📊 Original size: ${(originalSize / 1024).toFixed(1)} KB`);
    
    // Generate compressed version with metadata stripped (2400px max, 85% quality)
    console.log(`  🗜️  Generating compressed version (metadata stripped)...`);
    const compressed = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF, then strip EXIF
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .withMetadata(false) // Explicitly strip all metadata
      .toBuffer();
    
    const compressedSize = compressed.length;
    console.log(`  📊 Compressed size: ${(compressedSize / 1024).toFixed(1)} KB`);
    
    // Generate thumbnail - 150x150 cover crop, strip all metadata
    console.log(`  🖼️  Generating thumbnail...`);
    const thumbnail = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF, then strip EXIF
      .resize(150, 150, { fit: 'cover' })
      .webp({ quality: 60 })
      .withMetadata(false) // Explicitly strip all metadata
      .toBuffer();
    
    const thumbnailSize = thumbnail.length;
    console.log(`  📊 Thumbnail size: ${(thumbnailSize / 1024).toFixed(1)} KB`);
    
    if (isDryRun) {
      console.log(`  [DRY RUN] Would upload compressed to: ${key}`);
      console.log(`  [DRY RUN] Would upload thumbnail to: ${thumbnailKey}`);
      return { success: true, dryRun: true, originalSize, compressedSize, thumbnailSize };
    }
    
    // Upload compressed version (overwrites existing)
    const putCompressedCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: compressed,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000', // 1 year cache
    });
    
    await s3Client.send(putCompressedCommand);
    console.log(`  ✅ Uploaded compressed (metadata stripped): ${key}`);
    
    // Upload thumbnail
    const putThumbnailCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000', // 1 year cache
    });
    
    await s3Client.send(putThumbnailCommand);
    console.log(`  ✅ Uploaded thumbnail: ${thumbnailKey}`);
    
    return { success: true, originalSize, compressedSize, thumbnailSize };
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function listImagesInOrg(orgId, fileFilter = null) {
  const prefix = `organizations/${orgId}/images/`;
  console.log(`  📂 Listing images in ${prefix}...`);
  
  let objects = [];
  let continuationToken = null;
  
  // Handle pagination - S3 returns max 1000 objects per request
  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(listCommand);
    objects = objects.concat(response.Contents || []);
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  // Filter to only images (not in /uploads/ or /thumb/ subfolders)
  let images = objects.filter(obj => {
    const key = obj.Key;
    return key && 
           !key.endsWith('/') && 
           obj.Size > 0 &&
           !key.includes('/uploads/') &&
           !key.includes('/thumb/') &&
           /\.(jpg|jpeg|png)$/i.test(key);
  });
  
  // If specific file filter provided, only include matching files
  if (fileFilter) {
    images = images.filter(obj => obj.Key.includes(fileFilter));
    console.log(`  Filtered to ${images.length} images matching "${fileFilter}"`);
  } else {
    console.log(`  Found ${images.length} images (excluding uploads and thumbnails)`);
  }
  
  return images;
}

async function listOrganizations() {
  console.log('📂 Listing organizations...');
  
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'organizations/',
    Delimiter: '/',
  });
  
  const response = await s3Client.send(listCommand);
  const prefixes = response.CommonPrefixes || [];
  
  const orgIds = prefixes.map(p => p.Prefix.replace('organizations/', '').replace('/', ''));
  console.log(`Found ${orgIds.length} organizations`);
  
  return orgIds;
}

async function main() {
  console.log('🖼️  Generate Missing Thumbnails & Strip Metadata');
  console.log('=================================================');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log(`Specific org: ${specificOrgId || 'all'}`);
  console.log(`Specific file: ${specificFile || 'all'}`);
  console.log('');
  
  // Get list of organizations to process
  const orgIds = specificOrgId ? [specificOrgId] : await listOrganizations();
  
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    totalThumbnailSize: 0,
  };
  
  // Process each organization
  for (const orgId of orgIds) {
    console.log(`\n🏢 Processing organization: ${orgId}`);
    console.log('─'.repeat(50));
    
    const images = await listImagesInOrg(orgId, specificFile);
    const toProcess = limit ? images.slice(0, limit - results.total) : images;
    
    console.log(`Processing ${toProcess.length} images...`);
    console.log('');
    
    for (let i = 0; i < toProcess.length; i++) {
      const obj = toProcess[i];
      console.log(`[${results.total + 1}] ${obj.Key}`);
      
      const result = await generateThumbnail(obj.Key);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.success) {
        results.success++;
        if (result.originalSize) {
          results.totalOriginalSize += result.originalSize;
          results.totalCompressedSize += result.compressedSize || 0;
          results.totalThumbnailSize += result.thumbnailSize;
        }
      } else {
        results.failed++;
      }
      
      results.total++;
      console.log('');
      
      // Stop if we hit the limit
      if (limit && results.total >= limit) {
        console.log(`Reached limit of ${limit} images`);
        break;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (limit && results.total >= limit) {
      break;
    }
  }
  
  // Summary
  console.log('\n📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total processed: ${results.total}`);
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped (already exist): ${results.skipped}`);
  
  if (results.totalOriginalSize > 0) {
    console.log(`Total original size: ${(results.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total compressed size: ${(results.totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total thumbnail size: ${(results.totalThumbnailSize / 1024).toFixed(2)} KB`);
    console.log(`Average thumbnail size: ${(results.totalThumbnailSize / results.success / 1024).toFixed(1)} KB`);
  }
  
  if (isDryRun) {
    console.log('');
    console.log('ℹ️  This was a dry run. No thumbnails were uploaded.');
    console.log('Run without --dry-run to actually generate thumbnails.');
  }
}

main().catch(console.error);
