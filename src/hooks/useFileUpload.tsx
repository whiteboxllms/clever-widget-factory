import { useState } from 'react';
import { apiService } from '@/lib/apiService';
import { useEnhancedToast } from './useEnhancedToast';

export interface FileUploadOptions {
  bucket: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  generateFileName?: (file: File, index?: number) => string;
  onProgress?: (stage: string, progress: number, details: string) => void;
  validateFile?: (file: File) => void;
}

export interface FileUploadResult {
  url: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  fileType: 'image' | 'pdf' | 'other';
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const PDF_MIME_TYPE = 'application/pdf';

// Legacy export name for backwards compatibility
export const useFileUpload = () => {
  return useImageUploadImpl();
};

// Primary export - handles both images and PDFs
export const useImageUpload = () => {
  return useImageUploadImpl();
};

const useImageUploadImpl = () => {
  const [isUploading, setIsUploading] = useState(false);
  const enhancedToast = useEnhancedToast();

  const getFileType = (mimeType: string): 'image' | 'pdf' | 'other' => {
    if (IMAGE_MIME_TYPES.includes(mimeType)) return 'image';
    if (mimeType === PDF_MIME_TYPE) return 'pdf';
    return 'other';
  };

  const uploadSingleFile = async (
    file: File,
    options: FileUploadOptions
  ): Promise<FileUploadResult> => {
    const { validateFile } = options;

    // Validate file if validator provided
    if (validateFile) {
      validateFile(file);
    }

    const fileType = getFileType(file.type);

    // Default file validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 50MB.`);
    }

    if (fileType === 'other') {
      throw new Error(`Invalid file type: ${file.type}. Only images and PDFs are allowed.`);
    }

    try {
      const originalSize = file.size;

      // Get presigned URL from backend
      const presignedResponse = await apiService.post('/upload/presigned-url', {
        filename: file.name,
        contentType: file.type
      });
      
      const { presignedUrl, publicUrl } = presignedResponse;

      // Upload to S3 using presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.statusText}`);
      }

      enhancedToast.showUploadSuccess(file.name, publicUrl);

      return {
        url: publicUrl,
        fileName: file.name,
        originalSize,
        compressedSize: file.size,
        compressionRatio: 0,
        fileType
      };
    } catch (error) {
      console.error('File upload failed:', error);
      enhancedToast.showUploadError(
        error instanceof Error ? error.message : 'Upload failed',
        file.name
      );
      throw error;
    }
  };

  const uploadMultipleFiles = async (
    files: File[],
    options: FileUploadOptions
  ): Promise<FileUploadResult[]> => {
    const results: FileUploadResult[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const fileOptions = {
          ...options,
          generateFileName: options.generateFileName 
            ? (f: File) => options.generateFileName!(f, i + 1)
            : undefined
        };
        
        const result = await uploadSingleFile(file, fileOptions);
        results.push(result);
        
        // Small delay between uploads to prevent mobile browser memory issues
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to upload file ${i + 1}/${files.length}:`, file.name, error);
        errors.push(file.name);
        // Continue with next file instead of failing completely
      }
    }
    
    if (errors.length > 0 && results.length === 0) {
      throw new Error(`All uploads failed: ${errors.join(', ')}`);
    }
    
    if (errors.length > 0) {
      console.warn(`Partial upload success: ${results.length} succeeded, ${errors.length} failed`);
    }
    
    return results;
  };

  const uploadImages = async (
    files: File | File[],
    options: FileUploadOptions
  ): Promise<FileUploadResult | FileUploadResult[]> => {
    setIsUploading(true);
    
    try {
      if (Array.isArray(files)) {
        return await uploadMultipleFiles(files, options);
      } else {
        return await uploadSingleFile(files, options);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImages,
    uploadFiles: uploadImages, // Legacy alias
    isUploading
  };
};
