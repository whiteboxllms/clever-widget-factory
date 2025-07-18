import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from './useAppSettings';
import { DetailedCompressionResult, ProgressCallback } from '@/lib/enhancedImageUtils';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export function useEnhancedToast() {
  const { toast, dismiss } = useToast();
  const { settings } = useAppSettings();

  const showCompressionStart = (fileName: string, originalSize: number) => {
    if (settings.debugMode) {
      return toast({
        title: "🔄 Starting Image Compression",
        description: `File: ${fileName}\nOriginal: ${formatFileSize(originalSize)}\nAnalyzing compression strategy...`,
        duration: 3000,
      });
    } else {
      return toast({
        title: "Compressing image...",
        description: `Original size: ${formatFileSize(originalSize)}`,
        duration: 2000,
      });
    }
  };

  const showCompressionProgress: ProgressCallback = (stage, progress, details) => {
    if (settings.debugMode && details) {
      toast({
        title: `🔧 Compression Stage: ${stage}`,
        description: `Progress: ${Math.round(progress)}%\n${details}`,
        duration: 1500,
      });
    }
  };

  const showCompressionComplete = (result: DetailedCompressionResult) => {
    if (settings.debugMode) {
      const stageDetails = result.stages
        .map(stage => `${stage.name}: ${Math.round(stage.duration)}ms`)
        .join('\n');
      
      return toast({
        title: "✅ Compression Complete",
        description: `${result.originalFormat.toUpperCase()}→${result.finalFormat.toUpperCase()}: ${formatFileSize(result.originalSize)}→${formatFileSize(result.compressedSize)}\n${result.compressionRatio.toFixed(1)}% reduction in ${Math.round(result.timings.total)}ms\n\nStage timings:\n${stageDetails}`,
        duration: 6000,
      });
    } else {
      return toast({
        title: "Compression complete!",
        description: `${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${result.compressionRatio.toFixed(1)}% reduction)`,
        duration: 3000,
      });
    }
  };

  const showUploadStart = (fileName: string, fileSize: number) => {
    if (settings.debugMode) {
      return toast({
        title: "🚀 Starting Upload",
        description: `File: ${fileName}\nSize: ${formatFileSize(fileSize)}\nDestination: Supabase Storage\nInitializing upload stream...`,
        duration: 3000,
      });
    } else {
      return toast({
        title: "Uploading image...",
        description: "Please wait while we upload your compressed image",
        duration: 2000,
      });
    }
  };

  const showUploadProgress = (progress: UploadProgress) => {
    if (settings.debugMode) {
      toast({
        title: "📤 Upload Progress",
        description: `${Math.round(progress.percentage)}% complete\n${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)} transferred\nSpeed: ${formatTransferSpeed(progress.loaded, progress.total)}`,
        duration: 1000,
      });
    }
  };

  const showUploadSuccess = (fileName: string, url?: string) => {
    if (settings.debugMode) {
      return toast({
        title: "🎉 Upload Successful",
        description: `File: ${fileName}\n✅ Transfer complete\n${url ? `URL: ${url.substring(0, 50)}...` : '📍 File available in storage'}`,
        duration: 5000,
      });
    } else {
      return toast({
        title: "Upload successful!",
        description: "Your image has been uploaded and is ready to use",
        duration: 3000,
      });
    }
  };

  const showUploadError = (error: string, fileName?: string) => {
    if (settings.debugMode) {
      return toast({
        title: "❌ Upload Failed",
        description: `${fileName ? `File: ${fileName}\n` : ''}Error: ${error}\n\nTroubleshooting:\n• Check network connection\n• Verify file format\n• Try compressing further`,
        variant: "destructive",
        duration: 8000,
      });
    } else {
      return toast({
        title: "Upload failed",
        description: "Please try again or check your connection",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const showCompressionError = (error: string, fileName?: string) => {
    if (settings.debugMode) {
      return toast({
        title: "⚠️ Compression Failed",
        description: `${fileName ? `File: ${fileName}\n` : ''}Error: ${error}\n\nFallback: Using original file\nRecommendation: Try a different image format`,
        variant: "destructive",
        duration: 8000,
      });
    } else {
      return toast({
        title: "Compression failed",
        description: "Using original file instead",
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  return {
    showCompressionStart,
    showCompressionProgress,
    showCompressionComplete,
    showUploadStart,
    showUploadProgress,
    showUploadSuccess,
    showUploadError,
    showCompressionError,
    dismiss,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTransferSpeed(loaded: number, total: number): string {
  // This is a simplified speed calculation
  // In a real implementation, you'd track time elapsed
  const percentage = (loaded / total) * 100;
  if (percentage < 50) return 'Calculating...';
  if (percentage < 80) return 'Good speed';
  return 'Fast connection';
}