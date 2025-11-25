import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = 'cwf-dev-assets';
const S3_BASE_URL = `https://${BUCKET_NAME}.s3.us-west-2.amazonaws.com`;

// Transform relative path to full S3 URL
export function getS3Url(relativePath: string): string {
  if (!relativePath) return '';
  return `${S3_BASE_URL}/${relativePath}`;
}

// Upload file to S3
export async function uploadToS3(
  bucketPath: string, 
  fileName: string, 
  file: File | Blob
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const key = `${bucketPath}/${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: file.type || 'application/octet-stream',
    });

    await s3Client.send(command);
    
    return {
      success: true,
      url: getS3Url(key)
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

// Delete file from S3
export async function deleteFromS3(relativePath: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: relativePath,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
}

// Generate unique filename
export function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}-${randomId}.${extension}`;
}
