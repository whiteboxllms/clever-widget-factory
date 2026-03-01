# Task 7 Implementation Guide

## Overview

Task 7 updates the upload pipeline to support organization-scoped paths while maintaining backward compatibility with the existing `mission-attachments` structure.

## Architecture

### Current Flow (mission-attachments)
```
1. Frontend → cwf-presigned-upload → presigned URL for mission-attachments/uploads/{random}-{filename}
2. Frontend uploads to S3
3. S3 ObjectCreated event → cwf-image-compressor
4. Compressor saves:
   - Compressed: mission-attachments/{random}-{filename}
   - Thumbnail: mission-attachments/thumb/{random}-{filename}.webp
```

### New Flow (organization-scoped)
```
1. Frontend → cwf-presigned-upload → presigned URL for organizations/{org_id}/images/uploads/{uuid}.jpg
2. Frontend uploads to S3
3. S3 ObjectCreated event → cwf-image-compressor
4. Compressor saves:
   - Compressed: organizations/{org_id}/images/{uuid}.jpg
   - Thumbnail: organizations/{org_id}/images/thumb/{uuid}.webp
```

## Implementation Steps

### Step 1: Update cwf-presigned-upload Lambda (7.1-7.5)

**File**: `lambda/cwf-presigned-upload/index.mjs`

**Changes needed:**
1. Extract `organization_id` from Cognito token (event.requestContext.authorizer.claims)
2. Add environment variable: `USE_ORG_SCOPED_KEYS=false`
3. When flag enabled:
   - Generate UUID: `crypto.randomUUID()`
   - Use path: `organizations/{org_id}/images/uploads/{uuid}.{extension}`
4. When flag disabled:
   - Keep existing: `mission-attachments/uploads/{random}-{filename}`

**Example code:**
```javascript
const USE_ORG_SCOPED_KEYS = process.env.USE_ORG_SCOPED_KEYS === 'true';

// Extract organization_id from Cognito claims
const organizationId = event.requestContext?.authorizer?.claims?.['custom:organization_id'];

let key;
if (USE_ORG_SCOPED_KEYS) {
  if (!organizationId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'organization_id required' }) };
  }
  const uuid = crypto.randomUUID();
  const extension = filename.split('.').pop();
  key = `organizations/${organizationId}/images/uploads/${uuid}.${extension}`;
} else {
  // Existing behavior
  const random = Math.random().toString(36).substring(2, 11);
  key = `mission-attachments/uploads/${random}-${filename}`;
}
```

### Step 2: Update cwf-image-compressor Lambda (7.6)

**File**: `lambda/cwf-image-compressor/index.mjs`

**Changes needed:**
1. Detect path pattern (mission-attachments vs organizations)
2. Handle both patterns appropriately
3. Add CacheControl headers

**Example code:**
```javascript
// Detect path pattern
const isMissionAttachments = key.startsWith('mission-attachments/');
const isOrganizations = key.startsWith('organizations/');

let finalKey, thumbnailKey;

if (isMissionAttachments) {
  // Existing behavior
  finalKey = key.replace('/uploads/', '/');
  thumbnailKey = finalKey.replace(/^(mission-attachments\/)/, '$1thumb/').replace(/\.(jpg|jpeg|png)$/i, '.webp');
} else if (isOrganizations) {
  // New organization-scoped behavior
  // organizations/{org_id}/images/uploads/{uuid}.jpg → organizations/{org_id}/images/{uuid}.jpg
  finalKey = key.replace('/uploads/', '/');
  // organizations/{org_id}/images/{uuid}.jpg → organizations/{org_id}/images/thumb/{uuid}.webp
  thumbnailKey = finalKey.replace(/\/images\//, '/images/thumb/').replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

// Add CacheControl headers
const putCommand = new PutObjectCommand({
  Bucket: bucket,
  Key: finalKey,
  Body: compressed,
  ContentType: 'image/jpeg',
  CacheControl: 'public, max-age=31536000', // 1 year
});

const putThumbnailCommand = new PutObjectCommand({
  Bucket: bucket,
  Key: thumbnailKey,
  Body: thumbnail,
  ContentType: 'image/webp',
  CacheControl: 'public, max-age=31536000', // 1 year
});
```

### Step 3: Deploy and Test (7.7-7.11)

1. **Deploy cwf-presigned-upload** with `USE_ORG_SCOPED_KEYS=false`
   ```bash
   cd lambda/cwf-presigned-upload
   npm run deploy
   ```

2. **Deploy cwf-image-compressor** (backward compatible)
   ```bash
   cd lambda/cwf-image-compressor
   npm run deploy
   ```

3. **Test with old structure** (mission-attachments)
   - Upload an observation with images
   - Verify compression works
   - Verify thumbnail generation works

4. **Enable flag**: Set `USE_ORG_SCOPED_KEYS=true` in Lambda environment

5. **Test with new structure** (organizations)
   - Upload an observation with images
   - Verify path is `organizations/{org_id}/images/uploads/{uuid}.jpg`
   - Verify compression creates `organizations/{org_id}/images/{uuid}.jpg`
   - Verify thumbnail creates `organizations/{org_id}/images/thumb/{uuid}.webp`

## Benefits

1. **Organization isolation**: Images are scoped to organizations
2. **CloudFront ready**: Path structure matches CloudFront signed cookie policies
3. **Backward compatible**: Existing mission-attachments uploads still work
4. **Feature flag**: Safe rollout with easy rollback
5. **UUID-based**: No filename collisions, better security

## Next Steps

After Task 7 is complete:
- **Task 8**: Update frontend to use CloudFront with signed cookies
- **Task 9**: Test CloudFront image delivery
- **Task 10**: Make S3 private (only CloudFront can access)

