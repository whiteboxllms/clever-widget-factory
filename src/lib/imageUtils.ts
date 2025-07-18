import imageCompression from 'browser-image-compression';

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
}

/**
 * Compresses an image file with smart defaults for web upload
 */
export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> => {
  const defaultOptions = {
    maxSizeMB: 0.5, // Target 500KB
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp', // Use WebP for better compression
    initialQuality: 0.8,
    ...options,
  };

  try {
    const originalSize = file.size;
    
    // Compress the image
    const compressedFile = await imageCompression(file, defaultOptions);
    
    // If WebP isn't supported or compression failed, fallback to JPEG
    let finalFile = compressedFile;
    if (compressedFile.size >= originalSize * 0.9) {
      const jpegOptions = {
        ...defaultOptions,
        fileType: 'image/jpeg',
        initialQuality: 0.7,
      };
      finalFile = await imageCompression(file, jpegOptions);
    }

    const compressedSize = finalFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      file: finalFile,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
    };
  }
};

/**
 * Formats file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Creates a thumbnail version of an image
 */
export const createThumbnail = async (file: File): Promise<CompressionResult> => {
  return compressImage(file, {
    maxSizeMB: 0.05, // 50KB target for thumbnails
    maxWidthOrHeight: 300,
    initialQuality: 0.7,
  });
};