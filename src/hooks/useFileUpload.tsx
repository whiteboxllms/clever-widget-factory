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

/**
 * Upload a file to S3 using a presigned POST with FormData.
 *
 * The backend returns a POST URL and policy fields. The browser sends a
 * multipart/form-data POST which is a "simple" CORS request — no preflight
 * OPTIONS request is needed. This avoids intermittent CORS preflight failures
 * on mobile networks and budget routers.
 */
function uploadToS3(
  postUrl: string,
  postFields: Record<string, string>,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ ok: boolean; status: number; statusText: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    // All policy fields must come before the file
    Object.entries(postFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    // File must be the last field
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      // S3 POST returns 204 on success
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
      });
    });

    xhr.addEventListener('error', () => {
      reject(new TypeError(`S3 upload network error (status=${xhr.status})`));
    });

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new TypeError('S3 upload timed out'));
    });

    xhr.open('POST', postUrl);
    // Do NOT set Content-Type — browser sets it with the correct multipart boundary
    xhr.timeout = 300000; // 5 minutes
    xhr.send(formData);
  });
}

// ── Hook ──────────────────────────────────────────────────────────────

/** @deprecated Use useImageUpload instead */
export const useFileUpload = () => useImageUploadImpl();

export const useImageUpload = () => useImageUploadImpl();

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
    if (options.validateFile) options.validateFile(file);

    const fileType = getFileType(file.type);
    if (file.size > 50 * 1024 * 1024) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 50MB.`);
    }
    if (fileType === 'other') {
      throw new Error(`Invalid file type: ${file.type}. Only images and PDFs are allowed.`);
    }

    try {
      // Step 1: Get presigned POST credentials from backend
      const presignedResponse = await apiService.post('/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
      });

      const { publicUrl, postUrl, postFields } = presignedResponse;

      if (!postUrl || !postFields) {
        throw new Error('Backend did not return presigned POST credentials');
      }

      // Step 2: Upload to S3
      const result = await uploadToS3(postUrl, postFields, file);

      if (!result.ok) {
        throw new Error(`S3 upload failed: ${result.status} ${result.statusText}`);
      }

      enhancedToast.showUploadSuccess(file.name, publicUrl);

      return {
        url: publicUrl,
        fileName: file.name,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        fileType,
      };
    } catch (error) {
      enhancedToast.showUploadError(
        error instanceof Error ? error.message : 'Upload failed',
        file.name,
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
      try {
        const fileOptions = {
          ...options,
          generateFileName: options.generateFileName
            ? (f: File) => options.generateFileName!(f, i + 1)
            : undefined,
        };
        results.push(await uploadSingleFile(files[i], fileOptions));

        // Small delay between uploads to prevent mobile browser memory issues
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch {
        errors.push(files[i].name);
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new Error(`All uploads failed: ${errors.join(', ')}`);
    }
    return results;
  };

  const uploadImages = async (
    files: File | File[],
    options: FileUploadOptions
  ): Promise<FileUploadResult | FileUploadResult[]> => {
    setIsUploading(true);
    try {
      return Array.isArray(files)
        ? await uploadMultipleFiles(files, options)
        : await uploadSingleFile(files, options);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImages,
    uploadFiles: uploadImages,
    isUploading,
  };
};
