import { S3Client } from '@aws-sdk/client-s3';

// S3 client configuration
export const s3Client = new S3Client({
  region: 'us-west-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  },
});

export const S3_BUCKET = 'cwf-dev-assets';

// Bucket prefix mapping (replaces old bucket names)
export const BUCKET_PREFIXES = {
  'audit-photos': 'audit-photos/',
  'checkin-photos': 'checkin-photos/',
  'mission-attachments': 'mission-attachments/',
  'mission-evidence': 'mission-evidence/',
  'tool-issue-photos': 'tool-issue-photos/',
  'tool-resolution-photos': 'tool-resolution-photos/',
} as const;

export type BucketPrefix = keyof typeof BUCKET_PREFIXES;
