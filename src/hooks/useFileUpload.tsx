import { useState } from 'react';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, BUCKET_PREFIXES, BucketPrefix } from '@/lib/s3Client';
import { compressImageDetailed } from '@/lib/enhancedImageUtils';
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

export const useFileUpload = () => {
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
        // Show compression start toast
        const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

        // Compress the image with detailed progress
        const compressionResult = await compressImageDetailed(
          file,
          { maxSizeMB, maxWidthOrHeight },
          onProgress || enhancedToast.showCompressionProgress
        );

        // Show compression complete toast
        enhancedToast.showCompressionComplete(compressionResult);

        finalFile = compressionResult.file;
        originalSize = compressionResult.originalSize;
        compressedSize = compressionResult.compressedSize;
        compressionRatio = compressionResult.compressionRatio;
      } else {
        // For PDFs, just show upload start directly
        enhancedToast.showUploadStart(file.name, file.size);
      }

      // Generate filename with prefix
      const fileName = generateFileName 
        ? generateFileName(finalFile)
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${finalFile.name}`;
      
      const key = `${BUCKET_PREFIXES[bucket]}${fileName}`;

      // Show upload start toast for images (already shown for PDFs above)
      if (fileType === 'image') {
        enhancedToast.showUploadStart(fileName, compressedSize);
      }

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: finalFile,
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
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const fileOptions = {
        ...options,
        generateFileName: options.generateFileName 
          ? (f: File) => options.generateFileName!(f, i + 1)
          : undefined
      };
      
      const result = await uploadSingleFile(file, fileOptions);
      results.push(result);
    }
    
    return results;
  };

  const uploadFiles = async (
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
    uploadFiles,
    isUploading
  };
};
