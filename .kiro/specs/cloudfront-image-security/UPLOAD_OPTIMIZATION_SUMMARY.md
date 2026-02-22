# Upload Optimization & Thumbnail Generation Summary

## What We Accomplished

### 1. S3 Transfer Acceleration ✅
- **Enabled** on bucket `cwf-dev-assets`
- **Updated** `lambda/cwf-presigned-upload/index.mjs` to use accelerated endpoint
- **Result**: Upload speed improved from 17.8s to 4.81s (73% faster from Manila)

### 2. Thumbnail Generation ✅
- **Updated** `lambda/cwf-image-compressor/index.mjs` to generate thumbnails
- **Settings**: 150x150px, 60% WebP quality
- **Result**: Thumbnails are 2-7KB (perfect for gallery views)
- **Location**: `mission-attachments/thumb/{filename}.webp`

### 3. Metadata Preservation ✅
- **Added** `.withMetadata()` to both compression Lambdas
- **Preserves**: EXIF (GPS, timestamps, camera settings), ICC profile, XMP data
- **Verified**: Pixel phone images retain full 15KB+ EXIF data after compression

### 4. Local Image Preview ✅
- **Updated** `src/components/UnifiedActionDialog.tsx` to use blob URLs
- **Stores** File objects in memory for just-uploaded images
- **Result**: No ERR_BLOCKED_BY_ORB error, instant preview without S3 fetch

### 5. Thumbnail Display in Assets ✅
- **Added** `getThumbnailUrl()` function to `src/lib/imageUtils.ts`
- **Updated** `src/components/CombinedAssetsContainer.tsx` to use thumbnails
- **Result**: Gallery loads 7KB thumbnails instead of 1MB images

## File Structure

### Current Upload Flow
```
1. User uploads → mission-attachments/uploads/1234567890123-abc123-photo.jpg (original)
2. Lambda processes:
   - Compressed → mission-attachments/abc123-photo.jpg (1MB, with metadata)
   - Thumbnail → mission-attachments/thumb/abc123-photo.webp (7KB)
3. Database stores: mission-attachments/abc123-photo.jpg
```

### Organization-Scoped Migration (for future)
```
1. Original → mission-attachments/uploads/1234567890123-abc123-photo.jpg
2. Compressed → organizations/{orgId}/images/abc123-photo.jpg (with metadata)
3. Thumbnail → organizations/{orgId}/thumbnails/abc123-photo.webp
4. Database stores: organizations/{orgId}/images/abc123-photo.jpg
```

## Key Scripts

### Test Single Image
```bash
bash scripts/test-thumbnail-generation.sh <filename>
```

### Check Image Metadata
```bash
node scripts/check-image-metadata.mjs cwf-dev-assets <s3-key>
```

### Migrate All Images (with metadata)
```bash
bash scripts/migrate-mission-attachments.sh
```

## Lambda Functions

### cwf-image-compressor
- **Trigger**: S3 ObjectCreated in `mission-attachments/uploads/`
- **Actions**:
  - Compress to 2400px max, 85% JPEG quality, **with metadata**
  - Generate 150x150 WebP thumbnail at 60% quality
  - Upload to `mission-attachments/` and `mission-attachments/thumb/`

### cwf-backfill-compress
- **Purpose**: Batch reprocess existing images
- **Actions**: Same as image-compressor but processes in batches
- **Usage**: For migrating old images to add metadata/thumbnails

### cwf-presigned-upload
- **Purpose**: Generate presigned URLs for direct S3 upload
- **Feature**: Uses Transfer Acceleration for faster uploads from distant locations
- **Filename**: `{timestamp}-{guid}-{original-filename}.jpg`

## Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Upload speed (Manila) | 17.8s | 4.81s | 73% faster |
| Gallery load (5 images) | ~5MB | ~35KB | 99% reduction |
| Image preview | Fetch from S3 | Blob URL | Instant |
| Thumbnail size | N/A | 2-7KB | New feature |
| Metadata preservation | ❌ | ✅ | GPS, EXIF, XMP |

## Next Steps (Optional)

1. **Full organization migration**: Run `scripts/migrate-mission-attachments.sh` to process all images
2. **Database migration**: Update all image URL columns to point to organization-scoped paths
3. **Frontend updates**: Update image URL construction to use organization paths
4. **Cleanup**: Remove old images from `mission-attachments/` after migration

## Notes

- Original images in `uploads/` folder are kept for backup/verification
- Thumbnails use WebP format for better compression
- Metadata preservation works with `.withMetadata()` in Sharp
- GUID portion of filename is preserved for matching originals to compressed versions
