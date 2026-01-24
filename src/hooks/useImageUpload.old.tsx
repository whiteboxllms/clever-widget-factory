import { useState } from 'react';
import { s3Client, S3_BUCKET, BUCKET_PREFIXES, BucketPrefix, Upload } from '@/lib/s3Client';
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

    // Default file validation - stricter limit on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const maxSize = isMobile ? 15 * 1024 * 1024 : 15 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxMB = 15;
      const error = `Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is ${maxMB}MB.`;
      console.error(`[UPLOAD-${uploadId}] VALIDATION_FAILED:`, error);
      throw new Error(error);
    }

    // Accept common image types, HEIC (iOS), and PDFs
    const validTypes = ['image/', 'application/octet-stream', 'application/pdf']; // octet-stream for HEIC on some phones
    const isValidType = validTypes.some(type => file.type.startsWith(type)) || file.name.match(/\.(jpg|jpeg|png|gif|webp|heic|heif|pdf)$/i);
    
    console.log(`[UPLOAD-${uploadId}] VALIDATION:`, { type: file.type, isValidType });
    
    if (!isValidType) {
      const error = `Invalid file type: ${file.type}. Only image and PDF files are allowed.`;
      console.error(`[UPLOAD-${uploadId}] TYPE_INVALID:`, error);
      throw new Error(error);
    }

    try {
      let compressionResult;
      let compressedFile: File;
      
      // Skip compression for PDFs or large files on mobile
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        console.log(`[UPLOAD-${uploadId}] PDF_DETECTED: Skipping compression`);
        compressedFile = file;
        compressionResult = {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0
        };
      } else if (isMobile && file.size > 3 * 1024 * 1024) {
        // Skip compression for files >3MB on mobile to prevent crashes
        console.log(`[UPLOAD-${uploadId}] LARGE_FILE_ON_MOBILE: Skipping compression, uploading directly`);
        compressedFile = file;
        compressionResult = {
          file,
          originalSize: file.size,
          compressedSize: file.size,
          compressionRatio: 0
        };
      } else {
        console.log(`[UPLOAD-${uploadId}] COMPRESSION_START:`, { 
          elapsed: performance.now() - startTime,
          memory: (performance as any).memory?.usedJSHeapSize 
        });
        
        // Show compression start toast
        const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

        try {
          // Compress the image - downsampled to 1920px then compressed
          compressionResult = await compressImageSimple(
            file,
            { maxSizeMB, maxWidthOrHeight: 1920 }
          );
          compressedFile = compressionResult.file;
        } catch (compressionError) {
          console.warn(`[UPLOAD-${uploadId}] COMPRESSION_FAILED, uploading original:`, compressionError);
          enhancedToast.showCompressionError(
            'Compression failed, uploading original image. Server will compress.',
            file.name
          );
          compressedFile = file;
          compressionResult = {
            file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0
          };
        }

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

        // Show compression complete toast only if actually compressed
        if (compressionResult.compressionRatio > 0) {
          enhancedToast.showCompressionComplete({
            ...compressionResult,
            compressionRatio: compressionResult.compressionRatio,
            timings: { total: 0 },
            stages: [],
            originalFormat: file.type.split('/')[1] || 'unknown',
            finalFormat: 'jpeg',
            algorithm: 'Canvas compression'
          });
        }
      }

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

      // Convert File to Uint8Array (required by AWS SDK)
      const fileBuffer = await compressedFile.arrayBuffer();
      const uploadBody = new Uint8Array(fileBuffer);
      
      console.log(`[UPLOAD-${uploadId}] UPLOAD_BODY_PREPARED:`, { 
        elapsed: performance.now() - startTime,
        arraySize: uploadBody.length,
        memory: (performance as any).memory?.usedJSHeapSize
      });
      
      console.log(`[UPLOAD-${uploadId}] S3_UPLOAD_START:`, { 
        elapsed: performance.now() - startTime,
        key,
        bucket: S3_BUCKET,
        bodySize: uploadBody.length
      });

      // TODO: SECURITY - Replace direct S3 upload with presigned URL from backend
      // Current implementation exposes AWS credentials in frontend code
      // Proper solution: Backend generates presigned URLs for uploads
      
      if (!import.meta.env.VITE_AWS_ACCESS_KEY_ID || !import.meta.env.VITE_AWS_SECRET_ACCESS_KEY) {
        throw new Error('Upload service not configured. Contact administrator.');
      }

      const contentType = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') 
        ? 'application/pdf' 
        : 'image/jpeg';
      
      // Use multipart upload with progress tracking
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: S3_BUCKET,
          Key: key,
          Body: uploadBody,
          ContentType: contentType,
        },
        partSize: 5 * 1024 * 1024, // 5MB chunks
        queueSize: 4, // Upload 4 chunks in parallel
      });

      // Track upload progress
      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded && progress.total) {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`[UPLOAD-${uploadId}] PROGRESS:`, {
            loaded: (progress.loaded / 1024 / 1024).toFixed(2) + 'MB',
            total: (progress.total / 1024 / 1024).toFixed(2) + 'MB',
            percent: percent.toFixed(1) + '%'
          });
          onProgress?.('Uploading', percent, `${percent.toFixed(0)}%`);
        }
      });

      const result = await upload.done();

      console.log(`[UPLOAD-${uploadId}] S3_UPLOAD_COMPLETE:`, { 
        elapsed: performance.now() - startTime,
        etag: result.ETag,
        location: result.Location,
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
    const results: ImageUploadResult[] = [];
    const errors: { name: string; error: string }[] = [];
    
    // Force garbage collection between uploads on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const delayBetweenUploads = isMobile ? 1500 : 100; // Much longer delay on mobile for GC
    
    for (let i = 0; i < files.length; i++) {
      try {
        const fileOptions = {
          ...options,
          generateFileName: options.generateFileName 
            ? (f: File) => options.generateFileName!(f, i + 1)
            : undefined
        };
        
        const result = await uploadSingleImage(files[i], fileOptions);
        results.push(result);
        
        // Delay between uploads to allow garbage collection
        if (i < files.length - 1) {
          console.log(`[UPLOAD] Waiting ${delayBetweenUploads}ms before next upload (${i + 1}/${files.length} complete)`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenUploads));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        errors.push({ name: files[i].name, error: errorMsg });
      }
    }
    
    if (errors.length > 0 && results.length === 0) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      // Show actual error instead of generic message
      const errorDetails = errors.map(e => `${e.name}: ${e.error}`).join('; ');
      const errorMsg = isMobile 
        ? `Upload failed: ${errorDetails}`
        : `All uploads failed: ${errors.map(e => e.name).join(', ')}`;
      throw new Error(errorMsg);
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
    isUploading
  };
};