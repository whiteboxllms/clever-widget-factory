// Debug upload functionality in browser
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const debugUpload = async () => {
  console.log('🔍 Debugging upload functionality...');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('VITE_AWS_ACCESS_KEY_ID:', import.meta.env.VITE_AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
  console.log('VITE_AWS_SECRET_ACCESS_KEY:', import.meta.env.VITE_AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  
  // Test S3 client creation
  try {
    const s3Client = new S3Client({
      region: 'us-west-2',
      credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
      },
    });
    console.log('✅ S3 client created successfully');
    
    // Test upload
    const testContent = 'Browser test upload - ' + new Date().toISOString();
    const testKey = 'debug-uploads/browser-test-' + Date.now() + '.txt';
    
    const command = new PutObjectCommand({
      Bucket: 'cwf-dev-assets',
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    console.log('🚀 Attempting upload...');
    const result = await s3Client.send(command);
    console.log('✅ Browser upload successful!');
    console.log('ETag:', result.ETag);
    console.log('Public URL:', `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${testKey}`);
    
    return { success: true, url: `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${testKey}` };
    
  } catch (error) {
    console.error('❌ Browser upload failed:', error);
    return { success: false, error: error.message };
  }
};

// Add to window for easy testing
(window as any).debugUpload = debugUpload;
