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

const BUCKETS_TO_MIGRATE = [
  'tool-images',
  'mission-evidence', 
  'mission-attachments'
];

async function listSupabaseFiles(bucketName, folder = '') {
  try {
    const { data, error } = await supabase.storage.from(bucketName).list(folder, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    });
    
    if (error) {
      console.error(`Error listing files in ${bucketName}/${folder}:`, error);
      return [];
    }
    
    let allFiles = [];
    
    for (const item of data || []) {
      if (item.name === '.emptyFolderPlaceholder') continue;
      
      if (item.id === null) {
        // It's a folder, recurse into it
        const subFiles = await listSupabaseFiles(bucketName, folder ? `${folder}/${item.name}` : item.name);
        allFiles = allFiles.concat(subFiles);
      } else {
        // It's a file
        const fullPath = folder ? `${folder}/${item.name}` : item.name;
        allFiles.push({ ...item, fullPath });
      }
    }
    
    return allFiles;
  } catch (err) {
    console.error(`Exception listing ${bucketName}:`, err.message);
    return [];
  }
}

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

async function migrateBucket(bucketName) {
  console.log(`\n🔄 Migrating bucket: ${bucketName}`);
  
  const files = await listSupabaseFiles(bucketName);
  console.log(`Found ${files.length} files in ${bucketName}`);
  
  if (files.length === 0) {
    console.log(`No files to migrate in ${bucketName}`);
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of files) {
    console.log(`Downloading: ${file.fullPath}`);
    
    try {
      const { data: fileData, error } = await supabase.storage.from(bucketName).download(file.fullPath);
      
      if (error) {
        console.error(`❌ Download failed for ${file.fullPath}:`, error);
        failCount++;
        continue;
      }
      
      const success = await uploadToS3(bucketName, file.fullPath, fileData);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`❌ Exception processing ${file.fullPath}:`, err.message);
      failCount++;
    }
  }
  
  console.log(`\n📊 ${bucketName} Results:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
}

async function main() {
  console.log('🚀 Starting Supabase to S3 migration...\n');
  
  for (const bucketName of BUCKETS_TO_MIGRATE) {
    await migrateBucket(bucketName);
  }
  
  console.log('\n🎉 Migration complete!');
}

main().catch(console.error);
