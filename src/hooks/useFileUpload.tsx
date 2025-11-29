import { useState } from 'react';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, BUCKET_PREFIXES, BucketPrefix } from '@/lib/s3Client';
import { compressImageSimple } from '@/lib/simpleImageCompression';
import { useEnhancedToast } from './useEnhancedToast';

export interface FileUploadOptions {
  bucket: BucketPrefix;
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
    const {
      bucket,
      maxSizeMB = 0.5,
      maxWidthOrHeight = 1920,
      generateFileName,
      onProgress,
      validateFile
    } = options;

    // Validate file if validator provided
    if (validateFile) {
      validateFile(file);
    }

    const fileType = getFileType(file.type);

    // Default file validation
    const maxSize = fileType === 'pdf' ? 10 * 1024 * 1024 : 10 * 1024 * 1024; // 10MB for both
    if (file.size > maxSize) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${maxSize / 1024 / 1024}MB.`);
    }

    if (fileType === 'other') {
      throw new Error(`Invalid file type: ${file.type}. Only images and PDFs are allowed.`);
    }

    try {
      let finalFile: File = file;
      let originalSize = file.size;
      let compressedSize = file.size;
      let compressionRatio = 0;

      // Only compress images, skip compression for PDFs
      if (fileType === 'image') {
        enhancedToast.showCompressionStart(file.name, file.size);
        
        const compressionResult = await compressImageSimple(
          file,
          { maxSizeMB, maxWidthOrHeight }
        );

        finalFile = compressionResult.file;
        originalSize = compressionResult.originalSize;
        compressedSize = compressionResult.compressedSize;
        compressionRatio = compressionResult.compressionRatio;
        
        enhancedToast.showCompressionComplete({
          ...compressionResult,
          compressionRatio: compressionResult.compressionRatio,
          timings: { total: 0 },
          stages: [],
          originalFormat: file.type.split('/')[1] || 'unknown',
          finalFormat: 'jpeg',
          algorithm: 'Canvas compression'
        });
      } else {
        // For PDFs, just show upload start directly
        enhancedToast.showUploadStart(file.name, file.size);
      }

      // Generate filename with prefix
      const fileName = generateFileName 
        ? generateFileName(finalFile)
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${finalFile.name}`;
      
      const key = `${BUCKET_PREFIXES[bucket]}${fileName}`;

      // Show upload start toast
      enhancedToast.showUploadStart(fileName, compressedSize);

      // Convert File to ArrayBuffer for AWS SDK compatibility
      const fileBuffer = await finalFile.arrayBuffer();
      
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: finalFile.type,
      });

      await s3Client.send(command);

      // Generate public URL
      const publicUrl = `https://${S3_BUCKET}.s3.us-west-2.amazonaws.com/${key}`;

      // Show upload success
      enhancedToast.showUploadSuccess(fileName, publicUrl);

      return {
        url: publicUrl,
        fileName,
        originalSize,
        compressedSize,
        compressionRatio,
        fileType
      };
    } catch (error) {
      console.error('File upload failed:', error);
      // Show error toast if not already shown by enhanced toast
      if (error instanceof Error && !error.message.includes('Upload')) {
        enhancedToast.showUploadError(error.message, file.name);
      }
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
