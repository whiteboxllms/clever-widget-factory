import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';

interface PendingPhoto {
  id: string; // Temporary ID for tracking
  file: File;
  previewUrl: string;
  photo_description: string;
  photo_order: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface UploadTask {
  observationId: string;
  entity_type: string;
  entity_id: string;
  photos: PendingPhoto[];
}

interface UploadQueueContextType {
  getTaskPhotos: (observationId: string) => PendingPhoto[] | undefined;
  queueUpload: (observationId: string, entity_type: string, entity_id: string, photos: PendingPhoto[]) => void;
  retryPhoto: (observationId: string, photoId: string) => void;
  removePhoto: (observationId: string, photoId: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextType | undefined>(undefined);

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Map<string, UploadTask>>(new Map());
  const [tasksVersion, setTasksVersion] = useState(0); // Force re-renders
  const { uploadFiles } = useFileUpload();
  const { toast } = useToast();

  const processPhoto = useCallback(async (
    observationId: string,
    photo: PendingPhoto,
    entity_type: string,
    entity_id: string
  ) => {
    // Update status to uploading
    setTasks(prev => {
      const newTasks = new Map(prev);
      const task = newTasks.get(observationId);
      if (task) {
        task.photos = task.photos.map(p =>
          p.id === photo.id ? { ...p, status: 'uploading' as const } : p
        );
        newTasks.set(observationId, task);
      }
      return newTasks;
    });
    setTasksVersion(v => v + 1);

    try {
      // Upload the file
      const uploadResults = await uploadFiles([photo.file], { bucket: 'cwf-uploads' });
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const photoUrl = resultsArray[0].url;

      // Get current observation to append the new photo
      const stateServiceModule = await import('@/services/stateService');
      const observation = await stateServiceModule.stateService.getState(observationId);

      // Update observation with new photo
      await stateServiceModule.stateService.updateState(observationId, {
        state_text: observation.observation_text,
        photos: [
          ...observation.photos.map(p => ({
            photo_url: p.photo_url,
            photo_description: p.photo_description,
            photo_order: p.photo_order,
          })),
          {
            photo_url: photoUrl,
            photo_description: photo.photo_description,
            photo_order: observation.photos.length + photo.photo_order,
          },
        ],
        links: observation.links.map(l => ({
          entity_type: l.entity_type,
          entity_id: l.entity_id,
        })),
      });

      // Mark as completed and remove from queue after a brief delay
      setTasks(prev => {
        const newTasks = new Map(prev);
        const task = newTasks.get(observationId);
        if (task) {
          task.photos = task.photos.map(p =>
            p.id === photo.id ? { ...p, status: 'completed' as const } : p
          );
          
          // If all photos are completed, remove the task
          const allCompleted = task.photos.every(p => p.status === 'completed');
          if (allCompleted) {
            // Clean up preview URLs
            task.photos.forEach(p => URL.revokeObjectURL(p.previewUrl));
            newTasks.delete(observationId);
          } else {
            newTasks.set(observationId, task);
          }
        }
        return newTasks;
      });
      setTasksVersion(v => v + 1);

      // Invalidate queries to refresh the UI
      window.dispatchEvent(new CustomEvent('invalidate-states', { 
        detail: { entity_type, entity_id } 
      }));

    } catch (error) {
      console.error('Failed to upload photo:', error);
      
      // Mark as failed
      setTasks(prev => {
        const newTasks = new Map(prev);
        const task = newTasks.get(observationId);
        if (task) {
          task.photos = task.photos.map(p =>
            p.id === photo.id 
              ? { ...p, status: 'failed' as const, error: error instanceof Error ? error.message : 'Upload failed' }
              : p
          );
          newTasks.set(observationId, task);
        }
        return newTasks;
      });
      setTasksVersion(v => v + 1);

      toast({
        title: 'Upload failed',
        description: `Failed to upload photo. You can retry from the observation.`,
        variant: 'destructive',
      });
    }
  }, [uploadFiles, toast]);

  const queueUpload = useCallback((
    observationId: string,
    entity_type: string,
    entity_id: string,
    photos: PendingPhoto[]
  ) => {
    console.log('[UploadQueue] Queueing upload:', { observationId, entity_type, entity_id, photoCount: photos.length });
    
    // Add task to queue
    setTasks(prev => {
      const newTasks = new Map(prev);
      newTasks.set(observationId, {
        observationId,
        entity_type,
        entity_id,
        photos,
      });
      console.log('[UploadQueue] Tasks after queue:', Array.from(newTasks.keys()));
      return newTasks;
    });
    setTasksVersion(v => v + 1);

    // Start uploading all photos in parallel
    photos.forEach(photo => {
      console.log('[UploadQueue] Starting upload for photo:', photo.id);
      processPhoto(observationId, photo, entity_type, entity_id);
    });
  }, [processPhoto]);

  const getTaskPhotos = useCallback((observationId: string) => {
    const photos = tasks.get(observationId)?.photos;
    console.log('[UploadQueue] Getting task photos for:', observationId, 'found:', photos?.length || 0, 'total tasks:', tasks.size);
    return photos;
  }, [tasks, tasksVersion]); // Include tasksVersion to force updates

  const retryPhoto = useCallback((observationId: string, photoId: string) => {
    const task = tasks.get(observationId);
    if (!task) return;

    const photo = task.photos.find(p => p.id === photoId);
    if (!photo) return;

    processPhoto(observationId, photo, task.entity_type, task.entity_id);
  }, [tasks, processPhoto]);

  const removePhoto = useCallback((observationId: string, photoId: string) => {
    setTasks(prev => {
      const newTasks = new Map(prev);
      const task = newTasks.get(observationId);
      if (task) {
        const photo = task.photos.find(p => p.id === photoId);
        if (photo) {
          URL.revokeObjectURL(photo.previewUrl);
        }
        
        task.photos = task.photos.filter(p => p.id !== photoId);
        
        if (task.photos.length === 0) {
          newTasks.delete(observationId);
        } else {
          newTasks.set(observationId, task);
        }
      }
      return newTasks;
    });
    setTasksVersion(v => v + 1);
  }, []);

  return (
    <UploadQueueContext.Provider value={{ getTaskPhotos, queueUpload, retryPhoto, removePhoto }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error('useUploadQueue must be used within UploadQueueProvider');
  }
  return context;
}
