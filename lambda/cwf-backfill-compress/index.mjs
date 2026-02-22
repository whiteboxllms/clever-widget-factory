import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';
import sharp from 'sharp';

const { Client } = pg;
const s3Client = new S3Client({ region: 'us-west-2' });
const BUCKET = 'cwf-dev-assets';

// Folders to migrate
const FOLDERS_TO_MIGRATE = [
  'mission-attachments/uploads/',
  'mission-attachments/',
  'mission-evidence/',
  'tool-images/parts/',
  'tool-images/tools/',
  'tool-resolution-photos/'
];

// Database connection - will be initialized in handler
let dbClient = null;

async function getOrganizationIdForImage(s3Key) {
  try {
    // For now, just get the first organization_id from the actions table
    // In a real migration, you'd want to match images to their specific actions
    // But since this is a single-org system, we can use any org_id
    const query = `
      SELECT organization_id 
      FROM actions 
      LIMIT 1
    `;
    
    const result = await dbClient.query(query);
    
    if (result.rows.length === 0) {
      console.log(`No organizations found in database, using default`);
      return 'default';
    }
    
    return result.rows[0].organization_id;
  } catch (error) {
    console.error(`Error looking up organization for ${s3Key}:`, error);
    return 'default'; // Fallback on error
  }
}

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
    
    // Get organization_id from database
    const orgId = await getOrganizationIdForImage(key);
    console.log(`Organization ID: ${orgId}`);
    
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
    
    // Compress with sharp - preserve metadata (EXIF, GPS, timestamps)
    const compressed = await sharp(imageBuffer)
      .withMetadata()  // Preserve EXIF, ICC profile, orientation, etc.
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    
    // Generate thumbnail - 150x150 cover crop, target 15-30KB
    const thumbnail = await sharp(imageBuffer)
      .resize(150, 150, { fit: 'cover' })
      .webp({ quality: 60 })
      .toBuffer();
    
    const compressedSize = compressed.length;
    const thumbnailSize = thumbnail.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    console.log(`Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}% reduction)`);
    console.log(`Thumbnail: ${(thumbnailSize / 1024).toFixed(2)} KB`);
    
    // Upload to organization-scoped location
    // Extract filename from original key and strip timestamp
    const originalFilename = key.split('/').pop();
    
    // Remove timestamp prefix if present (format: 1769225129062-random-filename.jpg)
    // Keep only random-filename.jpg to match database format
    const filenameWithoutTimestamp = originalFilename.replace(/^\d{13}-/, '');
    const baseFilename = filenameWithoutTimestamp.replace(/\.(jpg|jpeg|png)$/i, '');
    
    // Upload compressed image
    const finalKey = `organizations/${orgId}/images/${filenameWithoutTimestamp}`;
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: finalKey,
      Body: compressed,
      ContentType: 'image/jpeg',
    });
    await s3Client.send(putCommand);
    console.log(`Uploaded compressed: ${finalKey}`);
    
    // Upload thumbnail
    const thumbnailKey = `organizations/${orgId}/thumbnails/${baseFilename}.webp`;
    const putThumbnailCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbnailKey,
      Body: thumbnail,
      ContentType: 'image/webp',
    });
    await s3Client.send(putThumbnailCommand);
    console.log(`Uploaded thumbnail: ${thumbnailKey}`);
    
    return { 
      success: true, 
      key, 
      finalKey,
      thumbnailKey,
      orgId,
      originalSize, 
      compressedSize,
      thumbnailSize,
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
  
  // Initialize database connection if not already connected
  if (!dbClient) {
    dbClient = new Client({
      host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  
  // Connect to database
  try {
    if (!dbClient._connected) {
      await dbClient.connect();
      console.log('Database connected');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Database connection failed',
        message: error.message,
      })
    };
  }
  
  try {
    // Parse parameters from event
    const batchSize = event.batchSize || 10;
    const startAfter = event.startAfter || null;
    const dryRun = event.dryRun || false;
    const prefix = event.prefix || FOLDERS_TO_MIGRATE[0]; // Allow specifying which folder to process
    
    console.log(`Batch size: ${batchSize}`);
    console.log(`Prefix: ${prefix}`);
    console.log(`Start after: ${startAfter || 'beginning'}`);
    console.log(`Dry run: ${dryRun}`);
    
    // List objects in specified folder
    const listParams = {
      Bucket: BUCKET,
      Prefix: prefix,
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
        const orgId = await getOrganizationIdForImage(obj.Key);
        const originalFilename = obj.Key.split('/').pop();
        const filenameWithoutTimestamp = originalFilename.replace(/^\d{13}-/, '');
        const baseFilename = filenameWithoutTimestamp.replace(/\.(jpg|jpeg|png)$/i, '');
        const finalKey = `organizations/${orgId}/images/${filenameWithoutTimestamp}`;
        const thumbnailKey = `organizations/${orgId}/thumbnails/${baseFilename}.webp`;
        results.details.push({ 
          key: obj.Key, 
          finalKey,
          thumbnailKey,
          orgId,
          dryRun: true 
        });
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
        results.totalThumbnailSize = (results.totalThumbnailSize || 0) + (result.thumbnailSize || 0);
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
      totalThumbnailKB: ((results.totalThumbnailSize || 0) / 1024).toFixed(2),
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
  // Note: Don't close the connection - Lambda will reuse it
};
