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

    const uploadId = Math.random().toString(36).substr(2, 9);
    const startTime = performance.now();
    console.log(`[UPLOAD-${uploadId}] START:`, { 
      name: file.name, 
      type: file.type, 
      size: file.size,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection?.effectiveType,
      memory: (performance as any).memory?.usedJSHeapSize
    });

    // Validate file if validator provided
    if (validateFile) {
      validateFile(file);
    }

    // Default file validation
    if (file.size > 10 * 1024 * 1024) {
      const error = `Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 10MB.`;
      console.error(`[UPLOAD-${uploadId}] VALIDATION_FAILED:`, error);
      throw new Error(error);
    }

    // Accept common image types and HEIC (iOS)
    const validTypes = ['image/', 'application/octet-stream']; // octet-stream for HEIC on some phones
    const isValidType = validTypes.some(type => file.type.startsWith(type)) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i);
    
    console.log(`[UPLOAD-${uploadId}] VALIDATION:`, { type: file.type, isValidType });
    
    if (!isValidType) {
      const error = `Invalid file type: ${file.type}. Only image files are allowed.`;
      console.error(`[UPLOAD-${uploadId}] TYPE_INVALID:`, error);
      throw new Error(error);
    }

    try {
      console.log(`[UPLOAD-${uploadId}] COMPRESSION_START:`, { 
        elapsed: performance.now() - startTime,
        memory: (performance as any).memory?.usedJSHeapSize 
      });
      
      // Show compression start toast
      const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

      // Compress the image with simple compression
      const compressionResult = await compressImageSimple(
        file,
        { maxSizeMB, maxWidthOrHeight }
      );

      // Log warnings if compression had issues
      if (compressionResult.warnings && compressionResult.warnings.length > 0) {
        console.warn(`[UPLOAD-${uploadId}] COMPRESSION_WARNINGS:`, compressionResult.warnings);
        
        // Show user-friendly warning for large files
        const largeFileWarning = compressionResult.warnings.find(w => w.type === 'large_file' || w.type === 'timeout_risk');
        if (largeFileWarning) {
          enhancedToast.showCompressionError(
            largeFileWarning.message,
            file.name
          );
        }
      }

      console.log(`[UPLOAD-${uploadId}] COMPRESSION_COMPLETE:`, { 
        elapsed: performance.now() - startTime,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        ratio: compressionResult.compressionRatio,
        memory: (performance as any).memory?.usedJSHeapSize,
        warnings: compressionResult.warnings?.length || 0
      });

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

      console.log(`[UPLOAD-${uploadId}] BUFFER_CONVERSION_START:`, { 
        elapsed: performance.now() - startTime,
        fileSize: compressedFile.size,
        memory: (performance as any).memory?.usedJSHeapSize
      });

      // Show upload start toast
      const uploadToast = enhancedToast.showUploadStart(fileName, compressionResult.compressedSize);

      // Convert File to ArrayBuffer for AWS SDK compatibility
      const fileBuffer = await compressedFile.arrayBuffer();
      
      console.log(`[UPLOAD-${uploadId}] BUFFER_CONVERTED:`, { 
        elapsed: performance.now() - startTime,
        bufferSize: fileBuffer.byteLength,
        memory: (performance as any).memory?.usedJSHeapSize
      });
      
      const uint8Array = new Uint8Array(fileBuffer);
      
      console.log(`[UPLOAD-${uploadId}] UINT8_CREATED:`, { 
        elapsed: performance.now() - startTime,
        arraySize: uint8Array.length,
        memory: (performance as any).memory?.usedJSHeapSize
      });
      
      console.log(`[UPLOAD-${uploadId}] S3_UPLOAD_START:`, { 
        elapsed: performance.now() - startTime,
        key,
        bucket: S3_BUCKET,
        bodySize: uint8Array.length
      });

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: uint8Array,
        ContentType: 'image/jpeg', // Always JPEG after compression
      });

      const result = await s3Client.send(command);

      console.log(`[UPLOAD-${uploadId}] S3_UPLOAD_COMPLETE:`, { 
        elapsed: performance.now() - startTime,
        etag: result.ETag,
        memory: (performance as any).memory?.usedJSHeapSize
      });

      // Generate public URL
      const publicUrl = `https://${S3_BUCKET}.s3.us-west-2.amazonaws.com/${key}`;

      // Show upload success
      enhancedToast.showUploadSuccess(fileName, publicUrl);

      console.log(`[UPLOAD-${uploadId}] SUCCESS:`, { 
        totalElapsed: performance.now() - startTime,
        url: publicUrl
      });

      return {
        url: publicUrl,
        fileName,
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio
      };
    } catch (error) {
      console.error(`[UPLOAD-${uploadId}] FAILED:`, {
        elapsed: performance.now() - startTime,
        error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        bucket,
        userAgent: navigator.userAgent,
        memory: (performance as any).memory?.usedJSHeapSize,
        connection: (navigator as any).connection?.effectiveType
      });
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
    const batchId = Math.random().toString(36).substr(2, 9);
    const batchStartTime = performance.now();
    
    console.log(`[BATCH-${batchId}] START:`, { 
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      memory: (performance as any).memory?.usedJSHeapSize
    });
    
    const results: ImageUploadResult[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      console.log(`[BATCH-${batchId}] FILE_${i + 1}/${files.length}:`, {
        elapsed: performance.now() - batchStartTime,
        fileName: file.name,
        memory: (performance as any).memory?.usedJSHeapSize
      });
      
      try {
        const fileOptions = {
          ...options,
          generateFileName: options.generateFileName 
            ? (f: File) => options.generateFileName!(f, i + 1)
            : undefined
        };
        
        const result = await uploadSingleImage(file, fileOptions);
        results.push(result);
        
        console.log(`[BATCH-${batchId}] FILE_${i + 1}_SUCCESS:`, {
          elapsed: performance.now() - batchStartTime,
          successCount: results.length,
          memory: (performance as any).memory?.usedJSHeapSize
        });
      } catch (error) {
        console.error(`[BATCH-${batchId}] FILE_${i + 1}_FAILED:`, {
          elapsed: performance.now() - batchStartTime,
          fileName: file.name,
          error
        });
        errors.push(file.name);
        // Continue with next file instead of failing completely
      }
    }
    
    console.log(`[BATCH-${batchId}] COMPLETE:`, {
      totalElapsed: performance.now() - batchStartTime,
      successCount: results.length,
      failureCount: errors.length,
      memory: (performance as any).memory?.usedJSHeapSize
    });
    
    if (errors.length > 0 && results.length === 0) {
      const errorMsg = `All uploads failed: ${errors.join(', ')}`;
      console.error(`[BATCH-${batchId}] ALL_FAILED:`, errorMsg);
      throw new Error(errorMsg);
    }
    
    if (errors.length > 0) {
      console.warn(`[BATCH-${batchId}] PARTIAL_SUCCESS:`, {
        succeeded: results.length,
        failed: errors.length,
        failedFiles: errors
      });
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