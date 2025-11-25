import { useState } from 'react';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, BUCKET_PREFIXES, BucketPrefix } from '@/lib/s3Client';
import { compressImageSimple } from '@/lib/simpleImageCompression';
import { useEnhancedToast } from './useEnhancedToast';

export interface ImageUploadOptions {
  bucket: BucketPrefix;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  generateFileName?: (file: File, index?: number) => string;
  onProgress?: (stage: string, progress: number, details: string) => void;
  validateFile?: (file: File) => void;
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
  const enhancedToast = useEnhancedToast();

  const uploadSingleImage = async (
    file: File,
    options: ImageUploadOptions
  ): Promise<ImageUploadResult> => {
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

    // Default file validation
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB.`);
    }

    if (!file.type.startsWith('image/')) {
      throw new Error(`Invalid file type: ${file.type}. Only image files are allowed.`);
    }

    try {
      // Show compression start toast
      const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

      // Compress the image with simple compression
      const compressionResult = await compressImageSimple(
        file,
        { maxSizeMB, maxWidthOrHeight }
      );

      // Show compression complete toast
      enhancedToast.showCompressionComplete({
        ...compressionResult,
        compressionRatio: compressionResult.compressionRatio,
        timings: { total: 0 },
        stages: [],
        originalFormat: file.type.split('/')[1] || 'unknown',
        finalFormat: 'jpeg',
        algorithm: 'Canvas compression'
      });

      const compressedFile = compressionResult.file;

      // Generate filename with prefix
      const fileName = generateFileName 
        ? generateFileName(compressedFile)
        : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${compressedFile.name}`;
      
      const key = `${BUCKET_PREFIXES[bucket]}${fileName}`;

      // Show upload start toast
      const uploadToast = enhancedToast.showUploadStart(fileName, compressionResult.compressedSize);

      // Convert File to ArrayBuffer for AWS SDK compatibility
      const fileBuffer = await compressedFile.arrayBuffer();
      
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: compressedFile.type,
      });

      const result = await s3Client.send(command);

      // Generate public URL
      const publicUrl = `https://${S3_BUCKET}.s3.us-west-2.amazonaws.com/${key}`;

      // Show upload success
      enhancedToast.showUploadSuccess(fileName, publicUrl);

      return {
        url: publicUrl,
        fileName,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio
      };
    } catch (error) {
      console.error('Image upload failed:', error);
      // Show error toast if not already shown by enhanced toast
      if (error instanceof Error && !error.message.includes('Upload')) {
        enhancedToast.showUploadError(error.message, file.name);
      }
      throw error;
    }
  };

  const uploadMultipleImages = async (
    files: File[],
    options: ImageUploadOptions
  ): Promise<ImageUploadResult[]> => {
    const results: ImageUploadResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const fileOptions = {
        ...options,
        generateFileName: options.generateFileName 
          ? (f: File) => options.generateFileName!(f, i + 1)
          : undefined
      };
      
      const result = await uploadSingleImage(file, fileOptions);
      results.push(result);
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
    isUploading
  };
};