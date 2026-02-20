import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'us-west-2' });
const BUCKET = 'cwf-dev-assets';
const PREFIX = 'mission-attachments/uploads/';

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function compressImage(key) {
  try {
    console.log(`Processing: ${key}`);
    
    // Download original
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3Client.send(getCommand);
    const imageBuffer = await streamToBuffer(response.Body);
    
    const originalSize = imageBuffer.length;
    console.log(`Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Skip PDFs
    if (key.toLowerCase().endsWith('.pdf')) {
      console.log('Skipping PDF');
      return { skipped: true, reason: 'PDF', key };
    }
    
    // Compress with sharp
    const compressed = await sharp(imageBuffer)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}% reduction)`);
    
    // Upload to final location
    const finalKey = key.replace('/uploads/', '/');
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: finalKey,
      Body: compressed,
      ContentType: 'image/jpeg',
    });
    
    await s3Client.send(putCommand);
    console.log(`Uploaded to: ${finalKey}`);
    
    return { 
      success: true, 
      key, 
      finalKey,
      originalSize, 
      compressedSize, 
      ratio: parseFloat(ratio)
    };
    
  } catch (error) {
    console.error(`Error processing ${key}:`, error);
    return { success: false, key, error: error.message };
  }
}

export const handler = async (event) => {
  console.log('Backfill compression Lambda invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Parse parameters from event
  const batchSize = event.batchSize || 10;
  const startAfter = event.startAfter || null;
  const dryRun = event.dryRun || false;
  
  console.log(`Batch size: ${batchSize}`);
  console.log(`Start after: ${startAfter || 'beginning'}`);
  console.log(`Dry run: ${dryRun}`);
  
  try {
    // List objects in uploads folder
    const listParams = {
      Bucket: BUCKET,
      Prefix: PREFIX,
      MaxKeys: batchSize,
    };
    
    if (startAfter) {
      listParams.StartAfter = startAfter;
    }
    
    console.log('Listing objects...');
    const listCommand = new ListObjectsV2Command(listParams);
    const listResponse = await s3Client.send(listCommand);
    
    const objects = (listResponse.Contents || []).filter(obj => {
      return obj.Key && !obj.Key.endsWith('/') && obj.Size > 0;
    });
    
    console.log(`Found ${objects.length} images to process`);
    
    if (objects.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No more images to process',
          completed: true,
          processed: 0,
        })
      };
    }
    
    // Process each image
    const results = {
      total: objects.length,
      success: 0,
      failed: 0,
      skipped: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      details: [],
    };
    
    for (const obj of objects) {
      if (dryRun) {
        console.log(`[DRY RUN] Would process: ${obj.Key}`);
        results.details.push({ key: obj.Key, dryRun: true });
        continue;
      }
      
      const result = await compressImage(obj.Key);
      results.details.push(result);
      
      if (result.skipped) {
        results.skipped++;
      } else if (result.success) {
        results.success++;
        results.totalOriginalSize += result.originalSize;
        results.totalCompressedSize += result.compressedSize;
      } else {
        results.failed++;
      }
    }
    
    // Calculate next batch info
    const lastKey = objects[objects.length - 1].Key;
    const hasMore = listResponse.IsTruncated;
    
    const summary = {
      processed: results.total,
      success: results.success,
      failed: results.failed,
      skipped: results.skipped,
      totalOriginalMB: (results.totalOriginalSize / 1024 / 1024).toFixed(2),
      totalCompressedMB: (results.totalCompressedSize / 1024 / 1024).toFixed(2),
      averageReduction: results.totalOriginalSize > 0 
        ? ((1 - results.totalCompressedSize / results.totalOriginalSize) * 100).toFixed(1) + '%'
        : 'N/A',
      hasMore,
      nextStartAfter: hasMore ? lastKey : null,
      dryRun,
    };
    
    console.log('Summary:', JSON.stringify(summary, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Batch processing complete',
        summary,
        details: results.details,
      })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Processing failed',
        message: error.message,
      })
    };
  }
};
