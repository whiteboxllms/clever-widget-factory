import { uploadToS3, getS3Url, generateFileName } from './src/lib/s3Service.ts';

// Test URL generation
console.log('Testing URL generation:');
console.log('Relative path: mission-evidence/test.jpg');
console.log('S3 URL:', getS3Url('mission-evidence/test.jpg'));

// Test filename generation
console.log('\nTesting filename generation:');
console.log('Original: test-image.jpg');
console.log('Generated:', generateFileName('test-image.jpg'));

console.log('\n✅ S3 service functions loaded successfully!');
