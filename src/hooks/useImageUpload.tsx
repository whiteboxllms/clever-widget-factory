import { useState } from 'react';
import { useEnhancedToast } from './useEnhancedToast';
import { apiService } from '@/lib/apiService';

export interface ImageUploadOptions {
  bucket: string;
  validateFile?: (file: File) => void;
  onProgress?: (fileName: string, progress: number) => void;
}

export interface ImageUploadResult {
  url: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const enhancedToast = useEnhancedToast();

  const updateProgress = (fileName: string, progress: number) => {
    setUploadProgress(prev => new Map(prev).set(fileName, progress));
  };

  const clearProgress = (fileName: string) => {
    setUploadProgress(prev => {
      const next = new Map(prev);
      next.delete(fileName);
      return next;
    });
  };

  const uploadSingleImage = async (
    file: File,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult> => {
    const { validateFile, onProgress } = options;

    const uploadId = Math.random().toString(36).substr(2, 9);
    const startTime = performance.now();
    console.log(`[UPLOAD-${uploadId}] START:`, { 
      name: file.name, 
      type: file.type, 
      size: file.size
    });

    if (validateFile) {
      validateFile(file);
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      const error = `Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 50MB.`;
      console.error(`[UPLOAD-${uploadId}] VALIDATION_FAILED:`, error);
      throw new Error(error);
    }

    const validTypes = ['image/', 'application/octet-stream', 'application/pdf'];
    const isValidType = validTypes.some(type => file.type.startsWith(type)) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|pdf)$/i);
    
    if (!isValidType) {
      const error = `Invalid file type: ${file.type}. Only image and PDF files are allowed.`;
      console.error(`[UPLOAD-${uploadId}] TYPE_INVALID:`, error);
      throw new Error(error);
    }

    try {
      console.log(`[UPLOAD-${uploadId}] REQUESTING_PRESIGNED_URL`);
      const presignedResponse = await apiService.post('/upload/presigned-url', {
        filename: file.name,
        contentType: file.type
      });
      
      const { presignedUrl, publicUrl } = presignedResponse;
      console.log(`[UPLOAD-${uploadId}] PRESIGNED_URL_RECEIVED:`, { publicUrl });

      console.log(`[UPLOAD-${uploadId}] UPLOADING_TO_S3`);
      
      // Initialize progress
      updateProgress(file.name, 0);
      
      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            console.log(`[UPLOAD-${uploadId}] PROGRESS: ${percentComplete.toFixed(1)}%`);
            updateProgress(file.name, percentComplete);
            onProgress?.(file.name, percentComplete);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed: ${xhr.statusText}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });
        
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });
        
        xhr.open('PUT', presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      console.log(`[UPLOAD-${uploadId}] SUCCESS:`, { 
        totalElapsed: performance.now() - startTime,
        url: publicUrl
      });

      // Clear progress after success
      clearProgress(file.name);

      enhancedToast.showUploadSuccess(file.name, publicUrl);

      return {
        url: publicUrl,
        fileName: file.name,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0
      };
    } catch (error) {
      console.error(`[UPLOAD-${uploadId}] FAILED:`, error);
      clearProgress(file.name);
      enhancedToast.showUploadError(
        error instanceof Error ? error.message : 'Upload failed',
        file.name
      );
      throw error;
    }
  };

  const uploadMultipleImages = async (
    files: File[],
    options: ImageUploadOptions
  ): Promise<ImageUploadResult[]> => {
    const results: ImageUploadResult[] = [];
    const errors: { name: string; error: string }[] = [];
    
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await uploadSingleImage(files[i], options);
        results.push(result);
        
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        errors.push({ name: files[i].name, error: errorMsg });
      }
    }
    
    if (errors.length > 0 && results.length === 0) {
      const errorDetails = errors.map(e => `${e.name}: ${e.error}`).join('; ');
      throw new Error(`Upload failed: ${errorDetails}`);
    }
    
    if (errors.length > 0) {
      enhancedToast.showUploadError(
        `${errors.length} file(s) failed to upload`,
        errors.map(e => e.name).join(', ')
      );
    }
    
    return results;
  };

  const uploadImages = async (
    files: File | File[],
    options: ImageUploadOptions
  ): Promise<ImageUploadResult | ImageUploadResult[]> => {
    setIsUploading(true);
    
    try {
      if (Array.isArray(files)) {
        return await uploadMultipleImages(files, options);
      } else {
        return await uploadSingleImage(files, options);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImages,
    isUploading,
    uploadProgress
  };
};
