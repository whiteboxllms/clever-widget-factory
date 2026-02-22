# Image Compression Backfill

This script compresses existing uncompressed images in S3 that were uploaded before the cwf-image-compressor Lambda was deployed.

## Problem

- Images uploaded before the compression Lambda was set up are stored uncompressed (2-8MB each)
- Database URLs were pointing to `/uploads/` folder (uncompressed originals)
- ~393 images in `mission-attachments/uploads/` need to be compressed

## Solution

1. **Database migration** (COMPLETED): Updated all photo URLs to remove `/uploads/` from paths
2. **Backfill compression** (THIS SCRIPT): Compress all images in `/uploads/` folder and save to final location

## Usage

### Dry Run (recommended first)

Test on 5 images without actually uploading:

```bash
node scripts/backfill-compress-images.js --dry-run --limit 5
```

### Process All Images

Compress all 393 images:

```bash
node scripts/backfill-compress-images.js
```

### Process in Batches

Process 50 images at a time:

```bash
node scripts/backfill-compress-images.js --limit 50
```

## Requirements

- Node.js 18+ with ES modules support
- AWS credentials configured (same as deployment credentials)
- Network access to S3 (if behind firewall, run from machine with S3 access)

## What It Does

For each image in `mission-attachments/uploads/`:

1. Downloads the uncompressed original
2. Compresses using Sharp:
   - Resize to max 2400px (preserves aspect ratio)
   - JPEG quality 85% with mozjpeg
   - Typically achieves 79-86% file size reduction
3. Uploads compressed version to `mission-attachments/` (without `/uploads/`)

## Expected Results

- **Input**: 393 images, ~2-8MB each, total ~2GB
- **Output**: 393 compressed images, ~300KB-1MB each, total ~400MB
- **Savings**: ~80% reduction in storage and bandwidth

## After Running

1. Verify images load correctly in the app
2. Wait 7 days to ensure no issues
3. Delete the `/uploads/` folder to reclaim storage:
   ```bash
   aws s3 rm s3://cwf-dev-assets/mission-attachments/uploads/ --recursive
   ```

## Troubleshooting

### Network Timeout

If downloads timeout, you may be behind a firewall blocking S3 data transfer. Try:
- Running from a different machine with S3 access
- Using a VPN
- Running from an EC2 instance in us-west-2

### Permission Errors

Ensure your AWS credentials have:
- `s3:GetObject` on `cwf-dev-assets/*`
- `s3:PutObject` on `cwf-dev-assets/*`

### Out of Memory

If processing large images causes memory issues, reduce batch size:
```bash
node --max-old-space-size=4096 scripts/backfill-compress-images.js --limit 10
```

## Related Files

- `migrations/fix-uploads-urls.sql` - Database migration (already run)
- `lambda/cwf-image-compressor/` - Lambda that compresses new uploads
- `lambda/cwf-presigned-upload/` - Lambda that generates upload URLs
