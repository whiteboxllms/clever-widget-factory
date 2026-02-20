#!/usr/bin/env node
/**
 * Backfill script to compress existing uncompressed images in S3
 * 
 * This script:
 * 1. Lists all images in mission-attachments/uploads/ (uncompressed originals)
 * 2. For each image, downloads, compresses with Sharp, and uploads to final location
 * 3. Logs progress and any errors
 * 
 * Usage: node scripts/backfill-compress-images.js [--dry-run] [--limit N]
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'us-west-2' });
const BUCKET = 'cwf-dev-assets';
const PREFIX = 'mission-attachments/uploads/';

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

async function streamToBuffer(stream) {
  console.log('    Converting stream to buffer...');
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of stream) {
    chunks.push(chunk);
    totalSize += chunk.length;
    if (chunks.length % 100 === 0) {
      console.log(`    Received ${totalSize} bytes...`);
    }
  }
  console.log(`    Total received: ${totalSize} bytes`);
  return Buffer.concat(chunks);
}

async function compressImage(key) {
  try {
    console.log(`  Downloading: ${key}`);
    
    // Download original
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(getCommand);
    const imageBuffer = await streamToBuffer(response.Body);
    
    const originalSize = imageBuffer.length;
    console.log(`  Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Skip PDFs
    if (key.toLowerCase().endsWith('.pdf')) {
      console.log(`  Skipping PDF`);
      return { skipped: true, reason: 'PDF' };
    }
    
    // Compress with sharp
    const compressed = await sharp(imageBuffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`  Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}% reduction)`);
    
    // Upload to final location
    const finalKey = key.replace('/uploads/', '/');
    
    if (isDryRun) {
      console.log(`  [DRY RUN] Would upload to: ${finalKey}`);
      return { success: true, dryRun: true, originalSize, compressedSize, ratio };
    }
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: finalKey,
      Body: compressed,
      ContentType: 'image/jpeg',
    });
    
    await s3Client.send(putCommand);
    console.log(`  ✓ Uploaded to: ${finalKey}`);
    
    return { success: true, originalSize, compressedSize, ratio };
    
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Backfill Image Compression');
  console.log('==========================');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Limit: ${limit || 'none'}`);
  console.log('');
  
  // List all objects in uploads folder
  console.log('Listing images from S3...');
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: PREFIX,
  });
  
  console.log('Sending ListObjectsV2Command...');
  const response = await s3Client.send(listCommand);
  console.log('Response received');
  const objects = response.Contents || [];
  console.log(`Raw objects count: ${objects.length}`);
  
  console.log(`Found ${objects.length} images in uploads folder`);
  console.log('');
  
  // Filter to only images (skip directories)
  const images = objects.filter(obj => {
    const key = obj.Key;
    return key && !key.endsWith('/') && obj.Size > 0;
  });
  
  const toProcess = limit ? images.slice(0, limit) : images;
  console.log(`Processing ${toProcess.length} images...`);
  console.log('');
  
  // Process each image
  const results = {
    total: toProcess.length,
    success: 0,
    failed: 0,
    skipped: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
  };
  
  for (let i = 0; i < toProcess.length; i++) {
    const obj = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${obj.Key}`);
    
    const result = await compressImage(obj.Key);
    
    if (result.skipped) {
      results.skipped++;
    } else if (result.success) {
      results.success++;
      if (result.originalSize) {
        results.totalOriginalSize += result.originalSize;
        results.totalCompressedSize += result.compressedSize;
      }
    } else {
      results.failed++;
    }
    
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('Summary');
  console.log('=======');
  console.log(`Total processed: ${results.total}`);
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  
  if (results.totalOriginalSize > 0) {
    const totalReduction = ((1 - results.totalCompressedSize / results.totalOriginalSize) * 100).toFixed(1);
    console.log(`Total original size: ${(results.totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total compressed size: ${(results.totalCompressedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total reduction: ${totalReduction}%`);
  }
  
  if (isDryRun) {
    console.log('');
    console.log('This was a dry run. No images were uploaded.');
    console.log('Run without --dry-run to actually compress images.');
  }
}

main().catch(console.error);
