#!/usr/bin/env node

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'us-west-2' });

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function checkMetadata(bucket, key) {
  console.log(`\n📷 Checking metadata for: ${key}\n`);
  
  try {
    // Download image
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3Client.send(getCommand);
    const imageBuffer = await streamToBuffer(response.Body);
    
    // Get metadata using Sharp
    const metadata = await sharp(imageBuffer).metadata();
    
    console.log('Image Metadata:');
    console.log('─'.repeat(50));
    console.log(`Format: ${metadata.format}`);
    console.log(`Width: ${metadata.width}px`);
    console.log(`Height: ${metadata.height}px`);
    console.log(`Space: ${metadata.space}`);
    console.log(`Channels: ${metadata.channels}`);
    console.log(`Depth: ${metadata.depth}`);
    console.log(`Density: ${metadata.density}`);
    console.log(`Has Alpha: ${metadata.hasAlpha}`);
    console.log(`Orientation: ${metadata.orientation || 'none'}`);
    
    if (metadata.exif) {
      console.log('\n✅ EXIF Data Present:');
      console.log(`   Size: ${metadata.exif.length} bytes`);
      
      // Try to parse some common EXIF fields
      try {
        const exifData = metadata.exif.toString('utf8', 0, Math.min(200, metadata.exif.length));
        console.log(`   Preview: ${exifData.substring(0, 100).replace(/[^\x20-\x7E]/g, '.')}`);
      } catch (e) {
        console.log('   (Binary data)');
      }
    } else {
      console.log('\n❌ No EXIF data found');
    }
    
    if (metadata.icc) {
      console.log(`\n✅ ICC Profile Present: ${metadata.icc.length} bytes`);
    }
    
    if (metadata.xmp) {
      console.log(`\n✅ XMP Data Present: ${metadata.xmp.length} bytes`);
    }
    
    if (metadata.iptc) {
      console.log(`\n✅ IPTC Data Present: ${metadata.iptc.length} bytes`);
    }
    
    console.log('\n' + '─'.repeat(50));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get arguments
const bucket = process.argv[2] || 'cwf-dev-assets';
const key = process.argv[3];

if (!key) {
  console.log('Usage: node check-image-metadata.mjs <bucket> <s3-key>');
  console.log('Example: node check-image-metadata.mjs cwf-dev-assets organizations/00000000-0000-0000-0000-000000000001/images/3jruub5jt-PXL_20250826_071848295.jpg');
  process.exit(1);
}

checkMetadata(bucket, key);
