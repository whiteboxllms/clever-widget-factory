import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const USE_TRANSFER_ACCELERATION = true; // Routes uploads through CloudFront edge locations
const BUCKET = 'cwf-dev-assets';

// Configure S3 client with Transfer Acceleration
const s3Client = new S3Client({ 
  region: 'us-west-2',
  useAccelerateEndpoint: USE_TRANSFER_ACCELERATION
});

export const handler = async (event) => {
  console.log('Presigned URL request:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body);
    const { filename, contentType } = body;
    
    if (!filename || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'filename and contentType required' })
      };
    }
    
    // Generate unique key with GUID at front (not timestamp)
    // Format: abc123-filename.jpg (GUID stays consistent across all versions)
    const random = Math.random().toString(36).substring(2, 11);
    const key = `mission-attachments/uploads/${random}-${filename}`;
    
    // Generate presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });
    
    // Public URL is the final location after compression (without /uploads/)
    // Filename stays the same: abc123-filename.jpg
    const finalKey = key.replace('/uploads/', '/');
    const publicUrl = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${finalKey}`;
    
    console.log('Generated presigned URL:', { uploadKey: key, finalKey, publicUrl });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        presignedUrl,
        publicUrl,
        key,
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate presigned URL' })
    };
  }
};
