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
  const fileSizeMB = file.size / (1024 * 1024);
  const targetMaxDimension = maxWidthOrHeight;
  
  // Try modern createImageBitmap API for memory-efficient decoding on mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const useImageBitmap = isMobile && 'createImageBitmap' in window;
  
  if (useImageBitmap) {
    try {
      // Get image dimensions first
      const img = await createImageBitmap(file);
      let { width, height } = img;
      img.close(); // Free memory immediately
      
      // Calculate target dimensions
      if (width > targetMaxDimension || height > targetMaxDimension) {
        if (width > height) {
          height = Math.round((height * targetMaxDimension) / width);
          width = targetMaxDimension;
        } else {
          width = Math.round((width * targetMaxDimension) / height);
          height = targetMaxDimension;
        }
      }
      
      // Decode and resize in one step - saves memory!
      const resizedBitmap = await createImageBitmap(file, {
        resizeWidth: width,
        resizeHeight: height,
        resizeQuality: 'high'
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Canvas not supported');
      
      ctx.drawImage(resizedBitmap, 0, 0);
      resizedBitmap.close(); // Free memory
      
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            canvas.width = 0;
            canvas.height = 0;
            
            if (!blob) {
              resolve({
                file,
                originalSize: file.size,
                compressedSize: file.size,
                compressionRatio: 0,
              });
              return;
            }
            
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            
            const compressionRatio = ((file.size - compressedFile.size) / file.size) * 100;
            
            resolve({
              file: compressedFile,
              originalSize: file.size,
              compressedSize: compressedFile.size,
              compressionRatio,
            });
          },
          'image/jpeg',
          0.8
        );
      });
    } catch (error) {
      console.warn('[COMPRESSION] ImageBitmap failed, falling back to canvas:', error);
      // Fall through to canvas method
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
      // Log memory before processing
      const memoryBeforeProcessing = (performance as any).memory?.usedJSHeapSize;
      
      // Calculate target dimensions BEFORE creating canvas
      let { width, height } = img;
      const targetMaxDimension = maxWidthOrHeight;
      
      if (width > targetMaxDimension || height > targetMaxDimension) {
        if (width > height) {
          height = (height * targetMaxDimension) / width;
          width = targetMaxDimension;
        } else {
          width = (width * targetMaxDimension) / height;
          height = targetMaxDimension;
        }
      }
      
      // Create canvas at TARGET size (not original size)
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
              
              // Clean up canvas and image to free memory
              canvas.width = 0;
              canvas.height = 0;
              img.src = '';
              
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
          
          // Clean up on error
          canvas.width = 0;
          canvas.height = 0;
          img.src = '';
          
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
      
      // Clean up on error
      canvas.width = 0;
      canvas.height = 0;
      img.src = '';
      
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
      });
    };
    
    // Timeout fallback - shorter since we're downsampling aggressively
    const timeoutDuration = 15000; // 15s timeout
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
      
      // Clean up on timeout
      canvas.width = 0;
      canvas.height = 0;
      img.src = '';
      
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
