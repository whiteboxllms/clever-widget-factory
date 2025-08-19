import { supabase } from '@/integrations/supabase/client';
import { compressImageDetailed } from '@/lib/enhancedImageUtils';
import { useEnhancedToast } from '@/hooks/useEnhancedToast';

export const imageService = {
  async uploadImage(file: File): Promise<string | null> {
    const enhancedToast = useEnhancedToast();
    
    try {
      // Enhanced compression with detailed tracking
      const compressionToast = enhancedToast.showCompressionStart(file.name, file.size);

      const compressionResult = await compressImageDetailed(
        file,
        {},
        enhancedToast.showCompressionProgress
      );
      
      enhancedToast.dismiss(compressionToast.id);
      const compressionCompleteToast = enhancedToast.showCompressionComplete(compressionResult);
      
      const compressedFile = compressionResult.file;
      const fileName = `${Date.now()}-${compressedFile.name}`;
      
      // Enhanced upload tracking
      enhancedToast.dismiss(compressionCompleteToast.id);
      const uploadToast = enhancedToast.showUploadStart(fileName, compressedFile.size);

      const { data, error } = await supabase.storage
        .from('tool-images')
        .upload(fileName, compressedFile);

      if (error) {
        enhancedToast.dismiss(uploadToast.id);
        const statusCode = error && typeof error === 'object' && 'status' in error ? error.status as number : undefined;
        enhancedToast.showUploadError(error.message, file.name, statusCode);
        return null;
      }

      enhancedToast.dismiss(uploadToast.id);
      
      const { data: urlData } = supabase.storage
        .from('tool-images')
        .getPublicUrl(fileName);

      enhancedToast.showUploadSuccess(fileName, urlData.publicUrl);
      return urlData.publicUrl;
      
    } catch (error: any) {
      enhancedToast.showCompressionError(error.message, file.name);
      return null;
    }
  }
};