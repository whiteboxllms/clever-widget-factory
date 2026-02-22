import { useState, useEffect } from 'react';
import { useStates, useStateMutations } from '@/hooks/useStates';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import { getImageUrl } from '@/lib/imageUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Upload, X, Edit2, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { CreateObservationData, Observation } from '@/types/observations';

interface StatesInlineProps {
  entity_type: 'action' | 'part' | 'tool' | 'issue' | 'policy';
  entity_id: string;
}

export function StatesInline({ entity_type, entity_id }: StatesInlineProps) {
  const { toast } = useToast();
  const { uploadFiles } = useFileUpload();
  
  // Fetch states for this entity
  const { data: states, isLoading, error } = useStates({ entity_type, entity_id });
  
  // Mutations
  const { createState, updateState, deleteState, isCreating, isUpdating, isDeleting } = 
    useStateMutations({ entity_type, entity_id });
  
  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  
  // Form state
  const [stateText, setStateText] = useState('');
  const [photos, setPhotos] = useState<Array<{ 
    file?: File;  // For new photos being uploaded
    photo_url?: string;  // For existing photos from S3
    photo_description: string; 
    photo_order: number;
    previewUrl: string;
    isExisting?: boolean;  // Flag to track if this is an existing photo
  }>>([]);

  // States are automatically cached by TanStack Query
  // Components can derive counts using useActionObservationCount hook
  // No need to notify parent components of count changes

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Add files to local state with previews
    const newPhotos = fileArray.map((file, index) => ({
      file,
      photo_description: '',
      photo_order: photos.length + index,
      previewUrl: URL.createObjectURL(file)
    }));
    
    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    const photo = photos[index];
    // Only revoke object URLs for new photos (not existing S3 URLs)
    if (photo.previewUrl && !photo.isExisting) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    setPhotos(prev => prev.filter((_, i) => i !== index).map((photo, i) => ({
      ...photo,
      photo_order: i
    })));
  };

  const handlePhotoDescriptionChange = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, photo_description: description } : photo
    ));
  };

  const resetForm = () => {
    // Clean up preview URLs (only for new photos, not existing S3 URLs)
    photos.forEach(p => {
      if (!p.isExisting && p.previewUrl) {
        URL.revokeObjectURL(p.previewUrl);
      }
    });
    setStateText('');
    setPhotos([]);
    setEditingStateId(null);
    setShowAddForm(false);
  };

  const handleSubmit = async () => {
    // Validate: require at least one of (text OR photo)
    if (stateText.trim().length === 0 && photos.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add observation text or at least one photo',
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploadingPhotos(true);
      
      // Process photos: upload new ones, keep existing ones
      let uploadedPhotos: Array<{ photo_url: string; photo_description: string; photo_order: number }> = [];
      
      if (photos.length > 0) {
        const newPhotos = photos.filter(p => !p.isExisting);
        const existingPhotos = photos.filter(p => p.isExisting);
        
        if (newPhotos.length > 0) {
          setUploadProgress(`Uploading ${newPhotos.length} new photo${newPhotos.length > 1 ? 's' : ''}...`);
        }
        
        // Upload new photos
        for (let i = 0; i < newPhotos.length; i++) {
          const photo = newPhotos[i];
          if (!photo.file) {
            console.error('New photo missing file object:', photo);
            continue;
          }
          
          setUploadProgress(`Uploading photo ${i + 1} of ${newPhotos.length}...`);
          
          const uploadResults = await uploadFiles([photo.file], { bucket: 'cwf-uploads' });
          const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
          const photoUrl = resultsArray[0].url;
          
          uploadedPhotos.push({
            photo_url: photoUrl,
            photo_description: photo.photo_description,
            photo_order: uploadedPhotos.length
          });
        }
        
        // Add existing photos (already have photo_url)
        existingPhotos.forEach(photo => {
          if (photo.photo_url) {
            uploadedPhotos.push({
              photo_url: photo.photo_url,
              photo_description: photo.photo_description,
              photo_order: uploadedPhotos.length
            });
          }
        });
      }
      
      setUploadProgress('Saving observation...');
      
      if (editingStateId) {
        // Update existing observation
        await updateState({
          id: editingStateId,
          data: {
            state_text: stateText.trim() || undefined,
            photos: uploadedPhotos
          }
        });
        
        toast({
          title: 'Observation updated',
          description: 'Your observation has been updated successfully.'
        });
      } else {
        // Create new observation with uploaded photos
        const data: CreateObservationData = {
          state_text: stateText.trim() || undefined,
          photos: uploadedPhotos,
          links: [{
            entity_type,
            entity_id
          }]
        };

        await createState(data);
        
        toast({
          title: 'Observation saved',
          description: 'Your observation has been saved successfully.'
        });
      }

      // Reset form and clean up preview URLs (only for new photos)
      photos.forEach(p => {
        if (!p.isExisting && p.previewUrl) {
          URL.revokeObjectURL(p.previewUrl);
        }
      });
      setStateText('');
      setPhotos([]);
      setShowAddForm(false);
      setEditingStateId(null);
      
    } catch (error) {
      console.error('Failed to save observation:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save observation. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setUploadingPhotos(false);
      setUploadProgress('');
    }
  };

  const handleEdit = (state: Observation) => {
    // Load the observation data for editing
    setEditingStateId(state.id);
    setStateText(state.observation_text || '');
    
    // Load existing photos into editable state
    const existingPhotos = (state.photos || []).map((photo, index) => ({
      photo_url: photo.photo_url,
      photo_description: photo.photo_description || '',
      photo_order: index,
      previewUrl: photo.photo_url, // Use S3 URL as preview
      isExisting: true
    }));
    setPhotos(existingPhotos);
    
    setShowAddForm(true);
    
    // Scroll to the form after React has re-rendered
    setTimeout(() => {
      const formElement = document.querySelector('[data-edit-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        console.warn('[StatesInline] Form element not found in DOM');
      }
    }, 300);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteState(id);
      toast({
        title: 'Observation deleted',
        description: 'The observation has been deleted successfully.'
      });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete observation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete observation. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Get labels based on entity type
  const textLabel = entity_type === 'action' ? 'Action and Reasoning' : 'Observation Text';
  const textPlaceholder = entity_type === 'action' 
    ? 'What did you do, and why?' 
    : 'Describe what you observed...';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>Failed to load observations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      {showAddForm ? (
        <Card data-edit-form className="border-2 border-primary">
          <CardContent className="pt-6 space-y-4">
            {editingStateId && (
              <div className="bg-primary/10 p-3 rounded-md mb-4">
                <p className="text-sm font-medium">✏️ Editing observation</p>
                <p className="text-xs text-muted-foreground mt-1">You can edit text, remove photos, edit descriptions, or add new photos.</p>
              </div>
            )}
            
            <div>
              <Label>Photos</Label>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
              <Button 
                variant="outline" 
                type="button" 
                className="w-full"
                onClick={() => document.getElementById('photo-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Photos
              </Button>
            </div>

            {photos.length > 0 && (
              <div className="space-y-2">
                {photos.map((photo, index) => (
                  <div key={index} className="flex gap-2 items-stretch border rounded p-2">
                    <div className="flex-shrink-0 w-1/2">
                      <img
                        src={photo.previewUrl}
                        alt={`Photo ${index + 1}`}
                        className="w-full aspect-square object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <Textarea
                        placeholder={`Description for photo ${index + 1}`}
                        value={photo.photo_description}
                        onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                        className="flex-1 resize-none"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="self-start"
                      onClick={() => handleRemovePhoto(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="state-text">{textLabel}</Label>
              <Textarea
                id="state-text"
                placeholder={textPlaceholder}
                value={stateText}
                onChange={(e) => setStateText(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={isCreating || isUpdating || uploadingPhotos}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isCreating || isUpdating || uploadingPhotos || (stateText.trim().length === 0 && photos.length === 0)}
              >
                {uploadingPhotos ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploadProgress}
                  </>
                ) : isCreating || isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingStateId ? 'Updating...' : 'Saving...'}
                  </>
                ) : (
                  editingStateId ? 'Update Observation' : 'Save Observation'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Observation
        </Button>
      )}

      {/* States List */}
      {states && states.length > 0 ? (
        <div className="space-y-3">
          {states.map((state) => (
            <Card key={state.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm text-muted-foreground">
                    {state.captured_by_name || 'Unknown'} • {format(new Date(state.captured_at), 'MMM d, yyyy h:mm a')}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(state)}
                      disabled={isDeleting}
                      title="Edit observation"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmId(state.id)}
                      disabled={isDeleting}
                      title="Delete observation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Content: Photo on left, text on right */}
                <div className="flex gap-3">
                  {/* First photo thumbnail */}
                  {state.photos && state.photos.length > 0 && (
                    <div className="flex-shrink-0 w-1/3">
                      <img
                        src={getImageUrl(state.photos[0].photo_url) || ''}
                        alt={state.photos[0].photo_description || 'Photo'}
                        className="w-full aspect-square object-cover rounded cursor-pointer"
                        onClick={() => window.open(getImageUrl(state.photos[0].photo_url) || '', '_blank')}
                        title={state.photos.length > 1 ? `${state.photos.length} photos` : undefined}
                      />
                      {state.photos.length > 1 && (
                        <p className="text-xs text-muted-foreground text-center mt-1">
                          +{state.photos.length - 1} more
                        </p>
                      )}
                    </div>
                  )}

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    {state.observation_text && (
                      <p className="text-sm whitespace-pre-wrap">
                        {state.observation_text.replace(/<[^>]*>/g, '').trim()}
                      </p>
                    )}
                    
                    {/* Photo descriptions if any */}
                    {state.photos && state.photos.some(p => p.photo_description) && (
                      <div className="mt-2 space-y-1">
                        {state.photos.map((photo, idx) => 
                          photo.photo_description ? (
                            <p key={photo.id} className="text-xs text-muted-foreground">
                              📷 {state.photos.length > 1 ? `${idx + 1}. ` : ''}{photo.photo_description}
                            </p>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !showAddForm && (
          <div className="text-center p-8 text-muted-foreground">
            <p>No observations yet</p>
          </div>
        )
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Observation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this observation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
