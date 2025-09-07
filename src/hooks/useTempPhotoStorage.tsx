
import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useEnhancedToast } from "@/hooks/useEnhancedToast";
import { compressImageDetailed } from "@/lib/enhancedImageUtils";
import { useOrganizationId } from "@/hooks/useOrganizationId";

export interface TempPhoto {
  id: string;
  file: File;
  fileName: string;
  fileUrl: string; // blob URL for preview
  taskTempId: string;
  uploadedAt: number;
}

export interface SavedPhoto {
  id: string;
  file_url: string;
  file_name: string;
}

export const useTempPhotoStorage = () => {
  const organizationId = useOrganizationId();
  const [tempPhotos, setTempPhotos] = useState<TempPhoto[]>([]);
  const enhancedToast = useEnhancedToast();

  const addTempPhoto = useCallback(async (file: File, taskTempId: string): Promise<string> => {
    const tempId = `temp-photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const blobUrl = URL.createObjectURL(file);
    
    const tempPhoto: TempPhoto = {
      id: tempId,
      file,
      fileName: file.name,
      fileUrl: blobUrl,
      taskTempId,
      uploadedAt: Date.now()
    };

    setTempPhotos(prev => [...prev, tempPhoto]);
    return tempId;
  }, []);

  const removeTempPhoto = useCallback((photoId: string) => {
    setTempPhotos(prev => {
      const photo = prev.find(p => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.fileUrl);
      }
      return prev.filter(p => p.id !== photoId);
    });
  }, []);

  const getTempPhotosForTask = useCallback((taskTempId: string): TempPhoto[] => {
    return tempPhotos.filter(p => p.taskTempId === taskTempId);
  }, [tempPhotos]);

  const migrateTempPhotos = useCallback(async (
    taskIdMap: Record<string, string>, // temp ID -> real ID
    missionId: string
  ): Promise<SavedPhoto[]> => {
    const savedPhotos: SavedPhoto[] = [];
    
    for (const tempPhoto of tempPhotos) {
      const realTaskId = taskIdMap[tempPhoto.taskTempId];
      if (!realTaskId) continue;

      try {
        // Show compression start
        const compressionToast = enhancedToast.showCompressionStart(tempPhoto.fileName, tempPhoto.file.size);
        
        // Compress the image
        const compressionResult = await compressImageDetailed(
          tempPhoto.file,
          { maxSizeMB: 0.5, maxWidthOrHeight: 1920 },
          enhancedToast.showCompressionProgress
        );
        
        // Show compression complete
        enhancedToast.showCompressionComplete(compressionResult);
        enhancedToast.dismiss(compressionToast.id);

        // Upload to Supabase
        const uploadToast = enhancedToast.showUploadStart(tempPhoto.fileName, compressionResult.compressedSize);
        
        const fileName = `${Date.now()}-${tempPhoto.fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('mission-evidence')
          .upload(fileName, compressionResult.file);

        if (uploadError) throw uploadError;

        // Save attachment record
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('mission_attachments')
          .insert({
            task_id: realTaskId,
            mission_id: missionId,
            file_name: tempPhoto.fileName,
            file_url: uploadData.path,
            file_type: compressionResult.file.type,
            organization_id: organizationId,
            attachment_type: 'evidence',
            uploaded_by: (await supabase.auth.getUser()).data.user?.id
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        enhancedToast.showUploadSuccess(tempPhoto.fileName);
        enhancedToast.dismiss(uploadToast.id);

        savedPhotos.push({
          id: attachmentData.id,
          file_url: attachmentData.file_url,
          file_name: attachmentData.file_name
        });

      } catch (error) {
        console.error('Failed to migrate photo:', tempPhoto.fileName, error);
        
        let errorMessage = 'Upload failed';
        let statusCode: number | undefined;
        
        if (error && typeof error === 'object') {
          if ('status' in error) {
            statusCode = error.status as number;
          }
          if ('message' in error) {
            errorMessage = error.message as string;
          }
        }
        
        enhancedToast.showUploadError(errorMessage, tempPhoto.fileName, statusCode);
      }
    }

    // Clean up blob URLs
    tempPhotos.forEach(photo => URL.revokeObjectURL(photo.fileUrl));
    setTempPhotos([]);

    return savedPhotos;
  }, [tempPhotos, enhancedToast]);

  const cleanupTempPhotos = useCallback(() => {
    tempPhotos.forEach(photo => URL.revokeObjectURL(photo.fileUrl));
    setTempPhotos([]);
  }, [tempPhotos]);

  return {
    tempPhotos,
    addTempPhoto,
    removeTempPhoto,
    getTempPhotosForTask,
    migrateTempPhotos,
    cleanupTempPhotos
  };
};
