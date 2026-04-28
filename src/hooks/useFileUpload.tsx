import { useState } from 'react';
import { apiService } from '@/lib/apiService';
import { useEnhancedToast } from './useEnhancedToast';
import { pushDiag } from '@/components/shared/UploadDiagnosticOverlay';

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

let uploadSessionId = 0;

// ── S3 Upload Strategies ──────────────────────────────────────────────
// Two strategies for uploading files to S3 via presigned credentials.
// POST is preferred because it avoids CORS preflight (OPTIONS) requests
// which fail intermittently on mobile networks.

interface S3UploadResult {
  ok: boolean;
  status: number;
  statusText: string;
}

/**
 * Strategy: Presigned POST with FormData
 * Browser sends: POST <url> with multipart/form-data body
 * Advantage: No CORS preflight — multipart/form-data POST is a "simple" request
 */
function uploadViaPost(
  postUrl: string,
  postFields: Record<string, string>,
  file: File,
  sid: number,
  sizeMB: string,
  onProgress?: (pct: number) => void,
): Promise<S3UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    // All policy fields must come before the file
    Object.entries(postFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    // File must be last
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress?.(pct);
      }
    });

    xhr.addEventListener('load', () => {
      // S3 POST returns 204 on success (not 200)
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
      });
    });

    xhr.addEventListener('error', () => {
      reject(new TypeError(`S3 POST network error (readyState=${xhr.readyState}, status=${xhr.status})`));
    });

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new TypeError(`S3 POST timeout after ${xhr.timeout}ms`));
    });

    xhr.open('POST', postUrl);
    // Do NOT set Content-Type — browser sets it with the correct multipart boundary
    xhr.timeout = 300000; // 5 minutes
    xhr.send(formData);
  });
}

/**
 * Strategy: Presigned PUT with raw body (legacy)
 * Browser sends: PUT <presignedUrl> with file as body + Content-Type header
 * Disadvantage: Triggers CORS preflight which fails on some mobile networks
 */
function uploadViaPut(
  presignedUrl: string,
  file: File,
  sid: number,
  sizeMB: string,
  tStart: number,
  onProgress?: (pct: number) => void,
): Promise<S3UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const xhrTimeline: string[] = [];

    xhr.addEventListener('readystatechange', () => {
      xhrTimeline.push(`rs=${xhr.readyState}@${Math.round(performance.now() - tStart)}ms`);
    });

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress?.(pct);
      }
    });

    xhr.addEventListener('load', () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        statusText: xhr.statusText,
      });
    });

    xhr.addEventListener('error', () => {
      const headers = xhr.getAllResponseHeaders() || '(none)';
      pushDiag('warn', `#${sid} XHR PUT error: timeline=[${xhrTimeline.join(',')}] headers=${headers.substring(0, 100)}`);
      reject(new TypeError(`S3 PUT network error (readyState=${xhr.readyState}, status=${xhr.status})`));
    });

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new TypeError(`S3 PUT timeout after ${xhr.timeout}ms`));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.timeout = 300000; // 5 minutes
    xhr.send(file);
  });
}

// ── Hook Implementation ───────────────────────────────────────────────

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
    const sid = ++uploadSessionId;
    const t0 = performance.now();
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const connType = (navigator as any).connection?.effectiveType ?? '?';

    pushDiag('info', `#${sid} START ${file.name} (${sizeMB}MB) conn=${connType} type=${file.type}`);

    if (validateFile) validateFile(file);

    const fileType = getFileType(file.type);
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 50MB.`);
    }
    if (fileType === 'other') {
      throw new Error(`Invalid file type: ${file.type}. Only images and PDFs are allowed.`);
    }

    try {
      const originalSize = file.size;

      // ── Step 1: Get presigned credentials from backend ─────────────
      const tPresignStart = performance.now();
      const presignedResponse = await apiService.post('/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
      });
      const tPresignEnd = performance.now();

      const { publicUrl, uploadMethod } = presignedResponse;
      pushDiag('ok', `#${sid} PRESIGN OK ${Math.round(tPresignEnd - tPresignStart)}ms method=${uploadMethod || 'put'}`);

      // ── Step 2: Upload to S3 (with retry) ─────────────────────────
      const MAX_UPLOAD_RETRIES = 3;
      const RETRY_DELAY_MS = 3000;
      const tUploadStart = performance.now();

      const attemptUpload = async (): Promise<S3UploadResult> => {
        let lastLoggedPct = -1;
        const onProgress = (pct: number) => {
          if (pct % 25 === 0 && pct !== lastLoggedPct) {
            lastLoggedPct = pct;
            pushDiag('info', `#${sid} progress ${pct}% (${(file.size * pct / 100 / 1024 / 1024).toFixed(1)}/${sizeMB}MB)`);
          }
        };

        if (uploadMethod === 'post' && presignedResponse.postUrl && presignedResponse.postFields) {
          pushDiag('info', `#${sid} S3 POST ${sizeMB}MB (no preflight)`);
          return uploadViaPost(
            presignedResponse.postUrl, presignedResponse.postFields,
            file, sid, sizeMB, onProgress,
          );
        } else {
          const presignedUrl = presignedResponse.presignedUrl;
          pushDiag('info', `#${sid} S3 PUT ${sizeMB}MB (legacy)`);
          return uploadViaPut(
            presignedUrl, file, sid, sizeMB, tUploadStart, onProgress,
          );
        }
      };

      let result: S3UploadResult | null = null;
      let lastUploadError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
        try {
          if (attempt > 1) {
            pushDiag('warn', `#${sid} RETRY ${attempt - 1}/${MAX_UPLOAD_RETRIES - 1} in ${RETRY_DELAY_MS}ms...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            // Re-request presigned credentials for retry (fresh signature)
            const retryPresign = await apiService.post('/upload/presigned-url', {
              filename: file.name,
              contentType: file.type,
            });
            Object.assign(presignedResponse, retryPresign);
          }

          result = await attemptUpload();

          if (!result.ok) {
            lastUploadError = new Error(`S3 HTTP ${result.status} ${result.statusText}`);
            pushDiag('warn', `#${sid} attempt ${attempt} HTTP ${result.status}`);
            result = null;
            continue;
          }
          break; // success
        } catch (err) {
          lastUploadError = err instanceof Error ? err : new Error(String(err));
          pushDiag(attempt < MAX_UPLOAD_RETRIES ? 'warn' : 'error',
            `#${sid} attempt ${attempt} failed: ${lastUploadError.message}`);
          result = null;
          if (err instanceof DOMException && err.name === 'AbortError') break;
        }
      }

      const tUploadEnd = performance.now();
      const uploadMs = Math.round(tUploadEnd - tUploadStart);
      const speedMbps = file.size > 0
        ? ((file.size * 8) / (uploadMs / 1000) / 1_000_000).toFixed(2)
        : '0';

      if (!result || !result.ok) {
        pushDiag('error', `#${sid} S3 FAILED after ${MAX_UPLOAD_RETRIES} attempts (${uploadMs}ms)`);
        throw lastUploadError ?? new Error('S3 upload failed after retries');
      }

      pushDiag('ok', `#${sid} S3 OK ${uploadMs}ms (${speedMbps} Mbps) total=${Math.round(tUploadEnd - t0)}ms`);
      enhancedToast.showUploadSuccess(file.name, publicUrl);

      return {
        url: publicUrl,
        fileName: file.name,
        originalSize,
        compressedSize: file.size,
        compressionRatio: 0,
        fileType,
      };
    } catch (error) {
      const elapsed = Math.round(performance.now() - t0);
      const msg = error instanceof Error ? error.message : String(error);
      pushDiag('error', `#${sid} FAILED: ${msg} after ${elapsed}ms online=${navigator.onLine}`);
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

    pushDiag('info', `BATCH ${files.length} files (${(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)}MB total)`);

    for (let i = 0; i < files.length; i++) {
      try {
        const fileOptions = {
          ...options,
          generateFileName: options.generateFileName
            ? (f: File) => options.generateFileName!(f, i + 1)
            : undefined,
        };
        const result = await uploadSingleFile(files[i], fileOptions);
        results.push(result);

        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          pushDiag('info', `Waiting 2s before next upload...`);
        }
      } catch {
        errors.push(files[i].name);
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new Error(`All uploads failed: ${errors.join(', ')}`);
    }
    if (errors.length > 0) {
      console.warn(`Partial upload: ${results.length} ok, ${errors.length} failed`);
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
    uploadFiles: uploadImages,
    isUploading,
  };
};
