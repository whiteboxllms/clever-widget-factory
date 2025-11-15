import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Test S3 upload functionality
const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: 'AKIAR5LFIL4OLQOKVRHI',
    secretAccessKey: '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',
  },
});

const testUpload = async () => {
  try {
    console.log('Testing S3 upload...');
    
    // Create a test file
    const testContent = 'Test upload from Node.js';
    const testKey = 'test-uploads/test-' + Date.now() + '.txt';
    
    const command = new PutObjectCommand({
      Bucket: 'cwf-dev-assets',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const result = await s3Client.send(command);
    console.log('✅ Upload successful!');
    console.log('ETag:', result.ETag);
    console.log('Public URL:', `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${testKey}`);
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    console.error('Error details:', error);
  }
};

testUpload();
