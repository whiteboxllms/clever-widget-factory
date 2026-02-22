/**
 * Utility functions for handling image URLs
 */

const S3_BUCKET_URL = 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com';

/**
 * Converts an S3 key or full URL to a complete S3 URL
 * @param urlOrKey - Either a full URL (starts with http) or an S3 key
 * @returns Full S3 URL
 */
export function getImageUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  
  // If it's already a full URL, return as-is
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }
  
  // Otherwise, construct the full S3 URL
  // Remove leading slash if present
  const key = urlOrKey.startsWith('/') ? urlOrKey.slice(1) : urlOrKey;
  return `${S3_BUCKET_URL}/${key}`;
}

/**
 * Extracts the S3 key from a full URL or returns the key as-is
 * @param urlOrKey - Either a full URL or an S3 key
 * @returns S3 key without the bucket URL
 */
export function getImageKey(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  
  // If it's a full S3 URL, extract the key
  if (urlOrKey.startsWith(S3_BUCKET_URL)) {
    return urlOrKey.replace(`${S3_BUCKET_URL}/`, '');
  }
  
  // If it's another full URL, return as-is (external image)
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }
  
  // Otherwise, it's already a key
  return urlOrKey;
}

/**
 * Converts an image URL/key to its thumbnail version
 * Thumbnails are stored in mission-attachments/thumb/ folder as WebP
 * @param urlOrKey - Either a full URL or an S3 key
 * @returns Full S3 URL to thumbnail, or null if not applicable
 */
export function getThumbnailUrl(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  
  // Get the key (strip bucket URL if present)
  const key = getImageKey(urlOrKey);
  if (!key) return null;
  
  // Only convert mission-attachments images to thumbnails
  if (!key.startsWith('mission-attachments/')) {
    // For non-mission-attachments, return original URL
    return getImageUrl(urlOrKey);
  }
  
  // Skip if already a thumbnail
  if (key.includes('/thumb/')) {
    return getImageUrl(urlOrKey);
  }
  
  // Convert to thumbnail path: mission-attachments/file.jpg -> mission-attachments/thumb/file.webp
  const thumbnailKey = key
    .replace(/^(mission-attachments\/)/, '$1thumb/')
    .replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  return `${S3_BUCKET_URL}/${thumbnailKey}`;
}
