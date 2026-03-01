# Fix S3 CORS Configuration

## Problem

Images uploaded to S3 are being blocked by the browser's ORB (Opaque Response Blocking) security policy when trying to display them. This causes images to disappear after upload.

## Root Cause

The S3 bucket `cwf-dev-assets` doesn't have proper CORS headers configured, so when the browser tries to fetch images cross-origin, it blocks them with `ERR_BLOCKED_BY_ORB`.

## Solution

Configure CORS on the S3 bucket to allow cross-origin requests from your application.

### Steps to Fix

1. **Go to AWS S3 Console**
   - Navigate to the `cwf-dev-assets` bucket
   - Click on the "Permissions" tab
   - Scroll down to "Cross-origin resource sharing (CORS)"

2. **Add CORS Configuration**

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:8080",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length",
            "Content-Type"
        ],
        "MaxAgeSeconds": 3000
    },
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "PUT"
        ],
        "AllowedOrigins": [
            "http://localhost:8080",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [],
        "MaxAgeSeconds": 3000
    }
]
```

3. **Save the CORS configuration**

4. **Test**
   - Upload a new observation with images
   - Images should now remain visible after upload
   - Check browser console - no more `ERR_BLOCKED_BY_ORB` errors

## Alternative: Use CloudFront (Recommended Long-term)

The proper long-term solution is to use CloudFront with signed cookies (already planned in `.kiro/specs/cloudfront-image-security/`). This provides:
- Better security (signed cookies instead of public S3)
- Better performance (CDN caching)
- Organization-scoped access control

Once CloudFront is implemented, S3 can be made private and CORS won't be needed.

## Temporary Workaround Applied

Added error handling to hide images that fail to load due to CORS errors. This prevents the UI from breaking, but images won't be visible until CORS is fixed.

