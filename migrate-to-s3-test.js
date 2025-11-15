import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(bucketName, fileName, fileData) {
  const key = `${bucketName}/${fileName}`;
  
  // Convert blob to buffer
  const buffer = Buffer.from(await fileData.arrayBuffer());
  
  const command = new PutObjectCommand({
    Bucket: 'cwf-dev-assets',
    Key: key,
    Body: buffer,
    ContentType: fileData.type || 'image/jpeg',
  });

  try {
    await s3Client.send(command);
    console.log(`✅ Uploaded: ${key}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${key}:`, error.message);
    return false;
  }
}

async function testMigration() {
  console.log('🧪 Testing migration with 2 files...\n');
  
  // Get first 2 files from tool-images
  const { data: files } = await supabase.storage.from('tool-images').list('', { limit: 2 });
  
  if (!files || files.length === 0) {
    console.log('No files found in tool-images bucket');
    return;
  }
  
  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;
    
    console.log(`Testing: ${file.name}`);
    
    const { data: fileData, error } = await supabase.storage.from('tool-images').download(file.name);
    
    if (error) {
      console.error(`❌ Download failed:`, error);
      continue;
    }
    
    await uploadToS3('tool-images', file.name, fileData);
  }
  
  console.log('\n🎉 Test complete!');
}

testMigration().catch(console.error);
