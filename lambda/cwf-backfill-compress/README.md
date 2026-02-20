# cwf-backfill-compress Lambda

One-time Lambda function to compress existing uncompressed images in S3.

## Purpose

Compresses ~393 images in `mission-attachments/uploads/` that were uploaded before the cwf-image-compressor Lambda was deployed. Processes images in batches to avoid timeouts and memory issues.

## Deployment

```bash
cd lambda/cwf-backfill-compress
./deploy.sh
```

## Usage

### 1. Dry Run (Test First)

Test on 5 images without actually compressing:

```bash
aws lambda invoke \
  --function-name cwf-backfill-compress \
  --payload '{"batchSize":5,"dryRun":true}' \
  --region us-west-2 \
  response.json && cat response.json | jq -r '.body' | jq
```

### 2. Process First Batch

Process 10 images:

```bash
aws lambda invoke \
  --function-name cwf-backfill-compress \
  --payload '{"batchSize":10}' \
  --region us-west-2 \
  response.json && cat response.json | jq -r '.body' | jq
```

### 3. Continue Processing

Use the `nextStartAfter` value from the previous response to continue:

```bash
aws lambda invoke \
  --function-name cwf-backfill-compress \
  --payload '{"batchSize":10,"startAfter":"mission-attachments/uploads/1769227611885-dy4lykpcb-PXL_20260122_000159219.jpg"}' \
  --region us-west-2 \
  response.json && cat response.json | jq -r '.body' | jq
```

### 4. Process All Images (Script)

Create a script to process all images in batches:

```bash
#!/bin/bash
# process-all-images.sh

BATCH_SIZE=20
START_AFTER=""

while true; do
  echo "Processing batch starting after: ${START_AFTER:-beginning}"
  
  if [ -z "$START_AFTER" ]; then
    PAYLOAD="{\"batchSize\":$BATCH_SIZE}"
  else
    PAYLOAD="{\"batchSize\":$BATCH_SIZE,\"startAfter\":\"$START_AFTER\"}"
  fi
  
  aws lambda invoke \
    --function-name cwf-backfill-compress \
    --payload "$PAYLOAD" \
    --region us-west-2 \
    response.json
  
  # Parse response
  BODY=$(cat response.json | jq -r '.body')
  HAS_MORE=$(echo "$BODY" | jq -r '.summary.hasMore')
  NEXT_START=$(echo "$BODY" | jq -r '.summary.nextStartAfter')
  
  echo "$BODY" | jq
  
  if [ "$HAS_MORE" != "true" ]; then
    echo "All images processed!"
    break
  fi
  
  START_AFTER="$NEXT_START"
  sleep 2  # Small delay between batches
done
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `batchSize` | number | 10 | Number of images to process in this invocation |
| `startAfter` | string | null | S3 key to start after (for pagination) |
| `dryRun` | boolean | false | If true, lists images but doesn't compress |

## Response Format

```json
{
  "message": "Batch processing complete",
  "summary": {
    "processed": 10,
    "success": 10,
    "failed": 0,
    "skipped": 0,
    "totalOriginalMB": "45.23",
    "totalCompressedMB": "8.91",
    "averageReduction": "80.3%",
    "hasMore": true,
    "nextStartAfter": "mission-attachments/uploads/1769227611885-dy4lykpcb-PXL_20260122_000159219.jpg",
    "dryRun": false
  },
  "details": [
    {
      "success": true,
      "key": "mission-attachments/uploads/1769225129062-1hk7m1z41-PXL_20260116_024747047.MP.jpg",
      "finalKey": "mission-attachments/1769225129062-1hk7m1z41-PXL_20260116_024747047.MP.jpg",
      "originalSize": 5729369,
      "compressedSize": 1145874,
      "ratio": 80.0
    }
  ]
}
```

## Configuration

- **Runtime**: Node.js 20.x
- **Memory**: 1024 MB (needed for Sharp image processing)
- **Timeout**: 300 seconds (5 minutes)
- **Region**: us-west-2

## How It Works

1. Lists objects in `mission-attachments/uploads/` (up to `batchSize`)
2. For each image:
   - Downloads from S3
   - Compresses with Sharp (max 2400px, 85% quality JPEG)
   - Uploads to final location (removes `/uploads/` from path)
3. Returns summary with pagination info for next batch

## Expected Results

- **Total images**: ~393
- **Average compression**: 79-86% file size reduction
- **Processing time**: ~20-30 seconds per batch of 10 images
- **Total time**: ~20-30 minutes for all images (at 20 images/batch)

## After Completion

1. Verify images load correctly in the app
2. Check database URLs point to compressed versions (already done via migration)
3. Wait 7 days to ensure no issues
4. Delete `/uploads/` folder to reclaim storage:
   ```bash
   aws s3 rm s3://cwf-dev-assets/mission-attachments/uploads/ --recursive
   ```

## Troubleshooting

### Lambda Timeout

If processing large images causes timeouts:
- Reduce `batchSize` to 5 or fewer
- Increase Lambda timeout (max 15 minutes)

### Out of Memory

If Lambda runs out of memory:
- Increase memory to 2048 MB
- Reduce `batchSize`

### Failed Compressions

Check CloudWatch logs for specific errors:
```bash
aws logs tail /aws/lambda/cwf-backfill-compress --follow --region us-west-2
```

## Cleanup

After all images are processed, you can delete the Lambda:

```bash
aws lambda delete-function \
  --function-name cwf-backfill-compress \
  --region us-west-2
```

## Related Files

- `lambda/cwf-image-compressor/` - Automatic compression for new uploads
- `migrations/fix-uploads-urls.sql` - Database migration (already run)
- `scripts/backfill-compress-images.js` - Alternative local script
