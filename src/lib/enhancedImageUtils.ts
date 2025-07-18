import imageCompression from 'browser-image-compression';
import { CompressionOptions } from './imageUtils';

export interface DetailedCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timings: {
    total: number;
    resize?: number;
    format?: number;
    quality?: number;
  };
  stages: CompressionStage[];
  originalFormat: string;
  finalFormat: string;
  algorithm: string;
}

export interface CompressionStage {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
  inputSize: number;
  outputSize: number;
}

export interface ProgressCallback {
  (stage: string, progress: number, details?: string): void;
}

/**
 * Enhanced image compression with detailed tracking and progress reporting
 */
export const compressImageDetailed = async (
  file: File,
  options: CompressionOptions = {},
  onProgress?: ProgressCallback
): Promise<DetailedCompressionResult> => {
  const startTime = performance.now();
  const stages: CompressionStage[] = [];
  
  const defaultOptions = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
    ...options,
  };

  const originalFormat = file.type.split('/')[1] || 'unknown';
  let algorithm = 'Standard compression';
  
  try {
    onProgress?.('Starting compression', 0, `Analyzing ${file.name} (${formatBytes(file.size)})`);
    
    // Stage 1: Analysis and preparation
    const analysisStart = performance.now();
    const needsResize = await checkIfNeedsResize(file, defaultOptions.maxWidthOrHeight || 1920);
    const analysisEnd = performance.now();
    
    stages.push({
      name: 'Analysis',
      startTime: analysisStart,
      endTime: analysisEnd,
      duration: analysisEnd - analysisStart,
      description: `File analysis and resize check`,
      inputSize: file.size,
      outputSize: file.size
    });

    onProgress?.('Compressing image', 25, needsResize ? 'Resizing and compressing' : 'Compressing');

    // Stage 2: Initial compression
    const compressionStart = performance.now();
    let compressedFile = await imageCompression(file, defaultOptions);
    const compressionEnd = performance.now();
    
    algorithm = defaultOptions.fileType === 'image/webp' ? 'WebP compression' : 'JPEG compression';
    
    stages.push({
      name: 'Compression',
      startTime: compressionStart,
      endTime: compressionEnd,
      duration: compressionEnd - compressionStart,
      description: `${algorithm} with quality ${defaultOptions.initialQuality}`,
      inputSize: file.size,
      outputSize: compressedFile.size
    });

    onProgress?.('Optimizing quality', 60, 'Fine-tuning compression settings');

    // Stage 3: Fallback optimization if needed
    let finalFile = compressedFile;
    const optimizationStart = performance.now();
    
    if (compressedFile.size >= file.size * 0.9) {
      onProgress?.('Applying fallback', 80, 'Trying alternative compression');
      
      const jpegOptions = {
        ...defaultOptions,
        fileType: 'image/jpeg',
        initialQuality: 0.7,
      };
      finalFile = await imageCompression(file, jpegOptions);
      algorithm = 'JPEG fallback compression';
    }
    
    const optimizationEnd = performance.now();
    
    stages.push({
      name: 'Optimization',
      startTime: optimizationStart,
      endTime: optimizationEnd,
      duration: optimizationEnd - optimizationStart,
      description: finalFile !== compressedFile ? 'Applied JPEG fallback' : 'No additional optimization needed',
      inputSize: compressedFile.size,
      outputSize: finalFile.size
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    onProgress?.('Complete', 100, `Compression finished in ${Math.round(totalTime)}ms`);

    const compressionRatio = ((file.size - finalFile.size) / file.size) * 100;
    const finalFormat = finalFile.type.split('/')[1] || 'unknown';

    return {
      file: finalFile,
      originalSize: file.size,
      compressedSize: finalFile.size,
      compressionRatio,
      timings: {
        total: totalTime,
        resize: needsResize ? stages[1]?.duration : undefined,
        format: stages[1]?.duration,
        quality: stages[2]?.duration,
      },
      stages,
      originalFormat,
      finalFormat,
      algorithm,
    };
  } catch (error) {
    console.error('Enhanced image compression failed:', error);
    
    // Return original file if compression fails
    const endTime = performance.now();
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
      timings: { total: endTime - startTime },
      stages,
      originalFormat,
      finalFormat: originalFormat,
      algorithm: 'No compression (error)',
    };
  }
};

async function checkIfNeedsResize(file: File, maxDimension: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width > maxDimension || img.height > maxDimension);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}