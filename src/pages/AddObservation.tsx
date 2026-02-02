import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Upload, X } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useObservationMutations } from '@/hooks/useObservations';
import { useToast } from '@/components/ui/use-toast';
import type { CreateObservationData } from '@/types/observations';

export default function AddObservation() {
  const { assetType, id } = useParams<{ assetType: string; id: string }>();
  const navigate = useNavigate();
  const { uploadFiles, isUploading } = useFileUpload();
  const { createObservation, isCreating } = useObservationMutations();
  const { toast } = useToast();

  const [photos, setPhotos] = useState<Array<{ photo_url: string; photo_description: string; photo_order: number; isUploading?: boolean; previewUrl?: string }>>([]);
  const [observationText, setObservationText] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Immediately show placeholder rows with local file previews
    const placeholders = fileArray.map((file, index) => ({
      photo_url: '',
      photo_description: '',
      photo_order: photos.length + index,
      isUploading: true,
      previewUrl: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...prev, ...placeholders]);

    setUploadProgress({ current: 0, total: files.length });

    try {
      // Upload all files in parallel
      const uploadPromises = fileArray.map(async (file, index) => {
        const uploadResults = await uploadFiles([file], { bucket: 'cwf-uploads' });
        const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
        
        // Update progress as each upload completes
        setUploadProgress(prev => prev ? { current: prev.current + 1, total: prev.total } : null);
        
        // Replace placeholder with actual S3 URL and revoke preview URL
        const photoIndex = photos.length + index;
        setPhotos(prev => prev.map((p, i) => {
          if (i === photoIndex) {
            if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
            return {
              photo_url: resultsArray[0].url,
              photo_description: '',
              photo_order: index,
              isUploading: false
            };
          }
          return p;
        }));
        
        return resultsArray[0];
      });
      
      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Failed to upload photos:', error);
      // Revoke preview URLs and remove failed placeholders
      setPhotos(prev => {
        prev.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
        return prev.filter(p => !p.isUploading);
      });
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handlePhotoDescriptionChange = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, photo_description: description } : photo
    ));
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index).map((photo, i) => ({
      ...photo,
      photo_order: i
    })));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      alert('Please add at least one photo');
      return;
    }

    const data: CreateObservationData = {
      observation_text: observationText || undefined,
      photos,
      links: [{
        entity_type: assetType === 'tools' ? 'tool' : 'part',
        entity_id: id!
      }]
    };

    try {
      await createObservation(data);
      toast({
        title: 'Observation saved',
        description: 'Your observation has been saved successfully.'
      });
      navigate('/combined-assets');
    } catch (error) {
      console.error('Failed to create observation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save observation. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/combined-assets')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Add Observation</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Photos</CardTitle>
            <div className="w-1/2">
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={isUploading}
              />
              <Button 
                variant="outline" 
                type="button" 
                disabled={isUploading} 
                className="w-full"
                onClick={() => document.getElementById('photo-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadProgress 
                  ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}...` 
                  : isUploading 
                    ? 'Uploading...' 
                    : 'Upload Photos'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {photos.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%] text-center font-semibold text-base">Description</TableHead>
                    <TableHead className="w-[60%] text-center font-semibold text-base">Photo</TableHead>
                    <TableHead className="w-[15%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {photos.map((photo, index) => (
                    <TableRow key={index}>
                      <TableCell className="align-top">
                        <Textarea
                          placeholder={`Description for photo ${index + 1}`}
                          value={photo.photo_description}
                          onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
                          className="min-h-[200px] resize-none"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="relative">
                          <img
                            src={photo.previewUrl || photo.photo_url}
                            alt={`Photo ${index + 1}`}
                            className="w-full max-h-48 object-contain rounded cursor-pointer"
                            onClick={() => !photo.isUploading && photo.photo_url && window.open(photo.photo_url, '_blank')}
                          />
                          {photo.isUploading && (
                            <div className="absolute top-2 right-2 bg-background/90 rounded-full p-2 shadow-lg">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePhoto(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <Label htmlFor="observation-text">Details</Label>
            <Textarea
              id="observation-text"
              placeholder="Details not captured elsewhere..."
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => navigate('/combined-assets')}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isCreating || photos.length === 0}
            >
              {isCreating ? 'Saving...' : 'Save Observation'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
