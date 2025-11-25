import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

async function testS3() {
  try {
    const command = new PutObjectCommand({
      Bucket: 'cwf-dev-assets',
      Key: 'test/test.txt',
      Body: 'Hello S3!',
      ContentType: 'text/plain',
    });

    await s3Client.send(command);
    console.log('✅ S3 upload successful!');
  } catch (error) {
    console.error('❌ S3 upload failed:', error);
  }
}

testS3();
