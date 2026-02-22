import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const s3Client = new S3Client({ region: 'us-west-2' });

export const handler = async (event) => {
  console.log('S3 event:', JSON.stringify(event, null, 2));
  
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    // Only process files in uploads/ folder
    if (!key.includes('/uploads/')) {
      console.log('Skipping non-upload file:', key);
      continue;
    }
    
    // Skip PDFs
    if (key.toLowerCase().endsWith('.pdf')) {
      console.log('Skipping PDF:', key);
      continue;
    }
    
    try {
      console.log('Processing:', { bucket, key });
      
      // Download original
      const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3Client.send(getCommand);
      const imageBuffer = await streamToBuffer(response.Body);
      
      console.log('Downloaded:', { size: imageBuffer.length });
      
      // Compress with sharp - downsample long side to max 2400px, preserve aspect ratio
      // CRITICAL: withMetadata() preserves EXIF (GPS, timestamps, camera info)
      const compressed = await sharp(imageBuffer)
        .withMetadata()  // Preserve EXIF, ICC profile, orientation, etc.
        .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      
      // Generate thumbnail - 150x150 cover crop, no metadata needed, target 15-30KB
      const thumbnail = await sharp(imageBuffer)
        .resize(150, 150, { fit: 'cover' })
        .webp({ quality: 60 })
        .toBuffer();
      
      console.log('Processed:', { 
        originalSize: imageBuffer.length, 
        compressedSize: compressed.length,
        thumbnailSize: thumbnail.length,
        compressionRatio: ((1 - compressed.length / imageBuffer.length) * 100).toFixed(1) + '%'
      });
      
      // Upload compressed to final location
      const finalKey = key.replace('/uploads/', '/');
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: finalKey,
        Body: compressed,
        ContentType: 'image/jpeg',
      });
      
      await s3Client.send(putCommand);
      console.log('Uploaded compressed:', finalKey);
      
      // Upload thumbnail to thumb/ subfolder
      const thumbnailKey = finalKey.replace(/^(mission-attachments\/)/, '$1thumb/').replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const putThumbnailCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailKey,
        Body: thumbnail,
        ContentType: 'image/webp',
      });
      
      await s3Client.send(putThumbnailCommand);
      console.log('Uploaded thumbnail:', thumbnailKey);
      
    } catch (error) {
      console.error('Error processing image:', error);
      // Don't throw - let other images process
    }
  }
  
  return { statusCode: 200 };
};

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
