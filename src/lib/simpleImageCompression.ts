export interface SimpleCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface CompressionWarning {
  type: 'large_file' | 'slow_compression' | 'low_memory' | 'timeout_risk';
  message: string;
  details: any;
}

export const compressImageSimple = async (
  file: File,
  options: { maxSizeMB?: number; maxWidthOrHeight?: number } = {}
): Promise<SimpleCompressionResult & { warnings?: CompressionWarning[] }> => {
  const { maxSizeMB = 0.5, maxWidthOrHeight = 1920 } = options;
  
  const warnings: CompressionWarning[] = [];
  const startTime = performance.now();
  const initialMemory = (performance as any).memory?.usedJSHeapSize;
  
  // Detect if file is potentially too large for mobile
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 3) {
    warnings.push({
      type: 'large_file',
      message: `Large file detected (${fileSizeMB.toFixed(2)}MB). Compression may be slow on mobile devices.`,
      details: { fileSizeMB, maxSizeMB }
    });
  }
  
  // Check available memory (if available)
  if ((performance as any).memory) {
    const availableMemory = (performance as any).memory.jsHeapSizeLimit - (performance as any).memory.usedJSHeapSize;
    const estimatedMemoryNeeded = file.size * 4; // Rough estimate: 4x file size for canvas operations
    if (estimatedMemoryNeeded > availableMemory * 0.5) {
      warnings.push({
        type: 'low_memory',
        message: `Low available memory. Compression may fail or be slow.`,
        details: { 
          availableMemoryMB: (availableMemory / (1024 * 1024)).toFixed(2),
          estimatedNeededMB: (estimatedMemoryNeeded / (1024 * 1024)).toFixed(2)
        }
      });
    }
  }
  
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      // Fallback: return original file if canvas not supported
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
      });
      return;
    }
    
    const img = new Image();
    let resolved = false;
    let objectUrl: string | null = null;
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = (height * maxWidthOrHeight) / width;
          width = maxWidthOrHeight;
        } else {
          width = (width * maxWidthOrHeight) / height;
          height = maxWidthOrHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Try different quality levels to meet size requirement
      let quality = 0.8;
      const tryCompress = () => {
        try {
          canvas.toBlob(
            (blob) => {
              if (resolved) return;
              
              if (!blob) {
                resolved = true;
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                resolve({
                  file,
                  originalSize: file.size,
                  compressedSize: file.size,
                  compressionRatio: 0,
                });
                return;
              }
            
            const targetSize = maxSizeMB * 1024 * 1024;
            
            const elapsed = performance.now() - startTime;
            
            // Warn if compression is taking too long
            if (elapsed > 5000 && !warnings.some(w => w.type === 'slow_compression')) {
              warnings.push({
                type: 'slow_compression',
                message: `Compression is taking longer than expected (${(elapsed / 1000).toFixed(1)}s). This may indicate the file is too large.`,
                details: { elapsed, fileSizeMB }
              });
            }
            
            if (blob.size <= targetSize || quality <= 0.1) {
              resolved = true;
              if (objectUrl) URL.revokeObjectURL(objectUrl);
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              
              const compressionRatio = ((file.size - compressedFile.size) / file.size) * 100;
              const finalMemory = (performance as any).memory?.usedJSHeapSize;
              
              // Warn if compression ratio is very low (couldn't compress much)
              if (compressionRatio < 10 && fileSizeMB > 2) {
                warnings.push({
                  type: 'large_file',
                  message: `Low compression ratio (${compressionRatio.toFixed(1)}%). File may be too large or complex for effective compression.`,
                  details: { compressionRatio, fileSizeMB, compressedSizeMB: (compressedFile.size / (1024 * 1024)).toFixed(2) }
                });
              }
              
              console.log('[COMPRESSION] Complete:', {
                originalSizeMB: (file.size / (1024 * 1024)).toFixed(2),
                compressedSizeMB: (compressedFile.size / (1024 * 1024)).toFixed(2),
                compressionRatio: compressionRatio.toFixed(1) + '%',
                elapsed: (elapsed / 1000).toFixed(2) + 's',
                memoryUsedMB: initialMemory && finalMemory ? ((finalMemory - initialMemory) / (1024 * 1024)).toFixed(2) : 'N/A',
                warnings: warnings.length > 0 ? warnings.map(w => w.message) : undefined
              });
              
              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: compressedFile.size,
                compressionRatio,
                ...(warnings.length > 0 && { warnings })
              });
            } else {
              // Try lower quality
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality
        );
        } catch (error) {
          if (resolved) return;
          resolved = true;
          console.error('Canvas compression failed:', error);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve({
            file,
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 0,
          });
        }
      };
      
      tryCompress();
    };
    
    img.onerror = () => {
      if (resolved) return;
      resolved = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
      });
    };
    
    // Timeout fallback for mobile browsers
    // Use longer timeout for large files, but warn if it's taking too long
    const timeoutDuration = fileSizeMB > 3 ? 20000 : 10000; // 20s for large files, 10s for normal
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      const elapsed = performance.now() - startTime;
      console.error('[COMPRESSION] Timeout:', {
        fileSizeMB: fileSizeMB.toFixed(2),
        elapsed: (elapsed / 1000).toFixed(2) + 's',
        timeoutDuration: (timeoutDuration / 1000).toFixed(0) + 's',
        message: 'Compression timed out. File may be too large for mobile compression.'
      });
      
      warnings.push({
        type: 'timeout_risk',
        message: `Compression timed out after ${(elapsed / 1000).toFixed(1)}s. File is likely too large for mobile compression.`,
        details: { elapsed, fileSizeMB, timeoutDuration }
      });
      
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        warnings
      });
    }, timeoutDuration);
    
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};
