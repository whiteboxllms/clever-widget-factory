# Lambda@Edge Image Resizer

On-demand image resizing and format conversion at CloudFront edge locations.

## Overview

This Lambda@Edge function processes images at CloudFront edge locations, providing:
- Dynamic image resizing (width/height)
- Format conversion (JPEG, PNG, WebP)
- Quality adjustment (1-100)
- Aspect ratio preservation
- Automatic caching at edge locations

## Configuration

**Runtime**: Node.js 18.x  
**Memory**: 512 MB (Sharp requires more memory for image processing)  
**Timeout**: 5 seconds  
**Region**: us-east-1 (Lambda@Edge requirement)  
**Trigger**: CloudFront origin-request event

## Environment Variables

- `S3_BUCKET`: S3 bucket name (default: cwf-dev-assets)
- `AWS_REGION`: AWS region for S3 access (default: us-west-2)

## Query Parameters

The function accepts the following query parameters:

- `width`: Target width in pixels (1-4000)
- `height`: Target height in pixels (1-4000)
- `quality`: Image quality (1-100, default: 80)
- `format`: Output format (jpeg, png, webp, default: webp)

### Examples

```
# Thumbnail (200px wide, WebP, 75% quality)
https://d1234567890.cloudfront.net/organizations/org-123/images/photo.jpg?width=200&quality=75&format=webp

# Preview (800px wide, WebP, 85% quality)
https://d1234567890.cloudfront.net/organizations/org-123/images/photo.jpg?width=800&quality=85&format=webp

# Original image (no parameters)
https://d1234567890.cloudfront.net/organizations/org-123/images/photo.jpg
```

## Image Processing

### Resize Behavior

- **Aspect Ratio**: Always maintained using Sharp's `fit: 'inside'` option
- **Upscaling**: Disabled (`withoutEnlargement: true`) to prevent quality loss
- **Dimensions**: If only width or height specified, other dimension calculated automatically

### Format Conversion

- **WebP**: Recommended for thumbnails and previews (best compression)
- **JPEG**: Good for photos, widely supported
- **PNG**: Best for images with transparency or text

### Quality Settings

- **Thumbnails (≤300px)**: 75% quality, WebP format (target: 50-100KB)
- **Previews (≤1000px)**: 85% quality, WebP format
- **Full-size**: Original format unless explicitly requested

## Deployment

### Prerequisites

1. **Sharp Library**: Must be compiled for Lambda environment
   ```bash
   npm install --arch=x64 --platform=linux sharp
   ```

2. **Lambda@Edge Requirements**:
   - Function must be in us-east-1 region
   - Must publish a version (Lambda@Edge requires versioned functions)
   - Must attach to CloudFront distribution behavior

### Deployment Steps

1. Install dependencies:
   ```bash
   cd lambda/image-resizer-edge
   npm install
   ```

2. Create deployment package:
   ```bash
   zip -r cwf-image-resizer-edge.zip index.js node_modules/
   ```

3. Create Lambda function in us-east-1:
   ```bash
   aws lambda create-function \
     --function-name cwf-image-resizer-edge \
     --runtime nodejs18.x \
     --role arn:aws:iam::ACCOUNT_ID:role/lambda-edge-execution-role \
     --handler index.handler \
     --zip-file fileb://cwf-image-resizer-edge.zip \
     --timeout 5 \
     --memory-size 512 \
     --region us-east-1
   ```

4. Publish version:
   ```bash
   aws lambda publish-version \
     --function-name cwf-image-resizer-edge \
     --region us-east-1
   ```

5. Attach to CloudFront distribution (see CloudFront configuration)

## IAM Permissions

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::cwf-dev-assets/*"
    }
  ]
}
```

## Error Handling

- **Invalid query params**: Ignored, defaults used
- **S3 fetch failure**: Returns 404 Not Found
- **Sharp processing failure**: Returns 500 Internal Server Error
- **Timeout (>5s)**: Returns 504 Gateway Timeout
- **Invalid S3 key pattern**: Returns 403 Forbidden

All errors are logged to CloudWatch for debugging.

## Performance

- **Cached images**: 15-50ms (served from edge location)
- **Uncached images**: <2s (fetch from S3 + resize + cache)
- **Cache TTL**: 24 hours (configurable via Cache-Control header)

## Testing

Run unit tests:
```bash
npm test
```

Run tests once:
```bash
npm run test:run
```

Generate coverage report:
```bash
npm run test:coverage
```

## Monitoring

CloudWatch metrics to monitor:
- Invocation count
- Error rate
- Duration (p50, p95, p99)
- Throttles

CloudWatch Logs:
- All requests logged with URI and query parameters
- Processing time and output size logged
- Errors logged with full stack traces

## Cost Optimization

- **Cache hit ratio**: Target >95% after warmup
- **Thumbnail optimization**: WebP format reduces bandwidth by 30-50%
- **Quality settings**: 75% quality for thumbnails balances quality and size
- **Edge caching**: Reduces origin requests and Lambda invocations

## Security

- **Organization-scoped keys**: Only processes images matching `organizations/*/images/*` pattern
- **CloudFront authentication**: Signed cookies validated before Lambda invocation
- **S3 access**: Uses Origin Access Identity, not public access
- **Input validation**: All query parameters validated and sanitized

## Troubleshooting

### Images not resizing
- Check CloudFront distribution has Lambda@Edge attached to origin-request event
- Verify Lambda function is published version (not $LATEST)
- Check CloudWatch Logs for errors

### 403 Forbidden errors
- Verify S3 key matches organization-scoped pattern
- Check Lambda execution role has S3 read permissions
- Verify CloudFront Origin Access Identity configured

### Slow performance
- Check Lambda memory allocation (increase if needed)
- Monitor CloudWatch metrics for duration
- Verify cache hit ratio (should be >95%)

### Out of memory errors
- Increase Lambda memory to 1024 MB
- Check image sizes (very large images may exceed memory)
- Consider implementing size limits

## Future Enhancements

- [ ] Support for HEIC input format
- [ ] Support for PDF first page extraction
- [ ] Automatic format selection based on Accept header
- [ ] Smart cropping (face detection)
- [ ] Watermarking support
- [ ] EXIF metadata preservation
