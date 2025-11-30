import { S3Client } from '@aws-sdk/client-s3';

// Validate credentials
const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  console.error('AWS credentials not configured. Set VITE_AWS_ACCESS_KEY_ID and VITE_AWS_SECRET_ACCESS_KEY in .env');
}

// S3 client configuration
export const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
  requestHandler: {
    requestTimeout: 30000, // 30 second timeout
  },
});

export const S3_BUCKET = 'cwf-dev-assets';

// Bucket prefix mapping (replaces old bucket names)
export const BUCKET_PREFIXES = {
  'audit-photos': 'audit-photos/',
  'checkin-photos': 'checkin-photos/',
  'mission-attachments': 'mission-attachments/',
  'mission-evidence': 'mission-evidence/',
  'tool-images': 'tool-images/',
  'tool-issue-photos': 'tool-issue-photos/',
  'tool-resolution-photos': 'tool-resolution-photos/',
} as const;

export type BucketPrefix = keyof typeof BUCKET_PREFIXES;
