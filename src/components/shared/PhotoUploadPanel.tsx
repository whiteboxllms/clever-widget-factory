import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, GripVertical, Loader2, AlertCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageUrl, getThumbnailUrl } from '@/lib/imageUtils';

export interface PhotoItem {
  id?: string;
  file?: File;
  photo_url?: string;
  photo_type?: string;
  photo_description?: string;
  photo_order: number;
  previewUrl?: string;
  isUploading?: boolean;
  isExisting?: boolean;
}

export interface PhotoUploadPanelProps {
  photos: PhotoItem[];
  onPhotosChange: (photos: PhotoItem[]) => void;
  photoTypes?: string[];
  requiredTypes?: string[];
  maxPhotos?: number;
  showDescriptions?: boolean;
  disabled?: boolean;
  className?: string;
  /** When provided, uploads files immediately on selection. Return the public URL. */
  onEagerUpload?: (file: File) => Promise<{ url: string }>;
}

/**
 * Returns the set of required photo types that are missing (no photo of that type exists).
 */
export function getMissingRequiredTypes(
  photos: PhotoItem[],
  requiredTypes?: string[]
): string[] {
  if (!requiredTypes || requiredTypes.length === 0) return [];
  const presentTypes = new Set(
    photos
      .filter((p) => !p.isUploading)
      .map((p) => p.photo_type)
      .filter(Boolean)
  );
  return requiredTypes.filter((t) => !presentTypes.has(t));
}

/**
 * Shared, reusable photo upload panel.
 *
 * Handles file selection (with mobile camera capture), blob URL previews,
 * photo type tagging, per-photo descriptions, remove/reorder, upload progress
 * indicators, and validation feedback for required photo types.
 *
 * Does NOT handle S3 upload — the parent component calls
 * `useFileUpload().uploadFiles()` on save and maps returned URLs back.
 */
export function PhotoUploadPanel({
  photos,
  onPhotosChange,
  photoTypes,
  requiredTypes,
  maxPhotos,
  showDescriptions = true,
  disabled = false,
  className,
  onEagerUpload,
}: PhotoUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Track latest photos via ref for async callbacks
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Track blob URLs we've created so we can revoke them on unmount
  const createdBlobUrls = useRef<Set<string>>(new Set());

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      createdBlobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const missingTypes = getMissingRequiredTypes(photos, requiredTypes);
  const hasValidationError = missingTypes.length > 0;
  const atMaxPhotos = maxPhotos != null && photos.length >= maxPhotos;

  // ── File selection ──────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const slotsAvailable =
        maxPhotos != null ? maxPhotos - photos.length : Infinity;
      const filesToAdd = fileArray.slice(0, slotsAvailable);

      const newItems: PhotoItem[] = filesToAdd.map((file, index) => {
        const blobUrl = URL.createObjectURL(file);
        createdBlobUrls.current.add(blobUrl);

        const defaultType = photoTypes?.[0];

        return {
          id: crypto.randomUUID(),
          file,
          photo_type: defaultType,
          photo_description: '',
          photo_order: photos.length + index,
          previewUrl: blobUrl,
          isUploading: !!onEagerUpload,
          isExisting: false,
        };
      });

      const updatedPhotos = [...photos, ...newItems];
      onPhotosChange(updatedPhotos);

      // Eager upload: start uploading each new file immediately
      if (onEagerUpload) {
        newItems.forEach((item) => {
          if (!item.file || !item.id) return;
          const itemId = item.id;
          onEagerUpload(item.file)
            .then(({ url }) => {
              const latest = photosRef.current.map((p) =>
                p.id === itemId
                  ? { ...p, photo_url: url, isUploading: false, file: undefined }
                  : p
              );
              onPhotosChange(latest);
            })
            .catch((err) => {
              console.error('Eager upload failed for', item.file?.name, err);
              const latest = photosRef.current.map((p) =>
                p.id === itemId ? { ...p, isUploading: false } : p
              );
              onPhotosChange(latest);
            });
        });
      }

      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [photos, onPhotosChange, photoTypes, maxPhotos, onEagerUpload]
  );

  // ── Photo mutations ─────────────────────────────────────────────────

  const handleRemove = useCallback(
    (index: number) => {
      const photo = photos[index];
      // Revoke blob URL if we created it
      if (
        photo.previewUrl &&
        photo.previewUrl.startsWith('blob:') &&
        !photo.isExisting
      ) {
        URL.revokeObjectURL(photo.previewUrl);
        createdBlobUrls.current.delete(photo.previewUrl);
      }
      const updated = photos
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, photo_order: i }));
      onPhotosChange(updated);
    },
    [photos, onPhotosChange]
  );

  const handleTypeChange = useCallback(
    (index: number, type: string) => {
      const updated = photos.map((p, i) =>
        i === index ? { ...p, photo_type: type } : p
      );
      onPhotosChange(updated);
    },
    [photos, onPhotosChange]
  );

  const handleDescriptionChange = useCallback(
    (index: number, description: string) => {
      const updated = photos.map((p, i) =>
        i === index ? { ...p, photo_description: description } : p
      );
      onPhotosChange(updated);
    },
    [photos, onPhotosChange]
  );

  // ── Drag-and-drop reorder ───────────────────────────────────────────

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...photos];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const updated = reordered.map((p, i) => ({ ...p, photo_order: i }));
    onPhotosChange(updated);

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Preview URL resolution ──────────────────────────────────────────

  const getPreviewSrc = (photo: PhotoItem): string => {
    if (photo.previewUrl) {
      // For existing photos, resolve through imageUtils
      if (photo.isExisting && !photo.previewUrl.startsWith('blob:')) {
        return getThumbnailUrl(photo.previewUrl) || getImageUrl(photo.previewUrl) || photo.previewUrl;
      }
      return photo.previewUrl;
    }
    if (photo.photo_url) {
      return getThumbnailUrl(photo.photo_url) || getImageUrl(photo.photo_url) || photo.photo_url;
    }
    return '';
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3', className)}>
      {/* Upload button */}
      <div>
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || atMaxPhotos}
        />
        <Button
          variant="outline"
          type="button"
          className="w-full"
          disabled={disabled || atMaxPhotos}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          {atMaxPhotos
            ? `Maximum ${maxPhotos} photos reached`
            : 'Add Photos'}
        </Button>
      </div>

      {/* Validation feedback for required types */}
      {hasValidationError && photos.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Required:{' '}
            {missingTypes.map((t) => (
              <Badge key={t} variant="destructive" className="mr-1 capitalize">
                {t}
              </Badge>
            ))}
            photo{missingTypes.length > 1 ? 's' : ''} missing
          </span>
        </div>
      )}

      {/* Photo list */}
      {photos.length > 0 && (
        <div className="space-y-2">
          {photos.map((photo, index) => (
            <div
              key={photo.id || index}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex gap-2 items-stretch border rounded p-2 transition-colors',
                dragOverIndex === index && 'border-primary bg-primary/5',
                dragIndex === index && 'opacity-50'
              )}
            >
              {/* Drag handle */}
              <div className="flex items-center cursor-grab active:cursor-grabbing">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Photo preview */}
              <div className="flex-shrink-0 w-24 relative">
                <img
                  src={getPreviewSrc(photo)}
                  alt={`Photo ${index + 1}`}
                  className="w-full aspect-square object-cover rounded"
                  onError={(e) => {
                    // Fallback: try original URL if thumbnail fails
                    if (photo.photo_url) {
                      const original = getImageUrl(photo.photo_url);
                      if (original && e.currentTarget.src !== original) {
                        e.currentTarget.src = original;
                        return;
                      }
                    }
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {photo.isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Photo metadata */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                {/* Photo type selector */}
                {photoTypes && photoTypes.length > 0 && (
                  <Select
                    value={photo.photo_type || ''}
                    onValueChange={(val) => handleTypeChange(index, val)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {photoTypes.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Description field */}
                {showDescriptions && (
                  <Textarea
                    placeholder={`Description for photo ${index + 1}`}
                    value={photo.photo_description || ''}
                    onChange={(e) =>
                      handleDescriptionChange(index, e.target.value)
                    }
                    className="flex-1 resize-none text-sm min-h-[60px]"
                    disabled={disabled}
                  />
                )}
              </div>

              {/* Remove button */}
              <Button
                variant="ghost"
                size="icon"
                className="self-start flex-shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Summary info */}
      {photos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
          {maxPhotos != null && ` of ${maxPhotos} max`}
          {photos.some((p) => p.isUploading) &&
            ` · ${photos.filter((p) => p.isUploading).length} uploading`}
        </p>
      )}
    </div>
  );
}
