import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useImageUpload } from '@/hooks/useImageUpload';
import { CheckCircle } from 'lucide-react';
import { BaseIssue } from "@/types/issues";
import { PhotoUploadPanel, type PhotoItem } from '@/components/shared/PhotoUploadPanel';

interface IssueQuickResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: BaseIssue | null;
  onSuccess: () => void;
}

export function IssueQuickResolveDialog({
  open,
  onOpenChange,
  issue,
  onSuccess
}: IssueQuickResolveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadImages, isUploading } = useImageUpload();
  const { user } = useAuth();

  const handleEagerUpload = useCallback(async (file: File) => {
    const result = await uploadImages(file, { bucket: 'tool-issue-photos' });
    const r = Array.isArray(result) ? result[0] : result;
    return { url: r.url };
  }, [uploadImages]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rootCause.trim() || !resolutionNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide both root cause and resolution notes",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload photos if any new ones were added
      let photoUrls: string[] = [];
      const newPhotos = photos.filter(p => p.file && !p.photo_url);
      if (newPhotos.length > 0) {
        const files = newPhotos.map(p => p.file!);
        const uploadResults = await uploadImages(files, {
          bucket: 'tool-issue-photos' as const
        });
        const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
        photoUrls = resultsArray.map(result => result.url);
      }

      await apiService.put(`/issues/${issue!.id}`, {
        status: 'resolved',
        root_cause: rootCause,
        resolution_notes: resolutionNotes,
        resolution_photo_urls: photoUrls,
        resolved_at: new Date().toISOString()
      });

      // Log the resolution in history
      await apiService.post('/issue_history', {
        issue_id: issue!.id,
        changed_by: user?.userId,
        old_status: issue!.status,
        new_status: 'resolved',
        field_changed: 'status',
        notes: `Issue resolved. Root cause: ${rootCause}. Resolution: ${resolutionNotes}`,
      });

      toast({
        title: "Issue Resolved",
        description: "The issue has been marked as resolved successfully"
      });

      // Refresh asset issue flags so card highlights update
      queryClient.invalidateQueries({ queryKey: ['issues_asset_flags'] });

      // Reset form
      setRootCause('');
      setResolutionNotes('');
      setPhotos([]);
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error resolving issue:', error);
      toast({
        title: "Error",
        description: "Failed to resolve issue",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!issue) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Resolve Issue
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Issue Reference */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Issue Details</h4>
            <p className="text-sm text-muted-foreground">
              <strong>{issue.issue_type}:</strong> {issue.description}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Root Cause */}
            <div>
              <Label htmlFor="rootCause">Root Cause *</Label>
              <Textarea
                id="rootCause"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="What was the underlying cause of this issue?"
                className="mt-1"
                rows={3}
                required
              />
            </div>

            {/* Resolution Notes */}
            <div>
              <Label htmlFor="resolutionNotes">Resolution Notes *</Label>
              <Textarea
                id="resolutionNotes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="How was this issue resolved? What steps were taken?"
                className="mt-1"
                rows={4}
                required
              />
            </div>

            {/* Photo Upload */}
            <div>
              <Label className="text-sm font-medium">Resolution Photos (Optional)</Label>
              <div className="mt-1">
                <PhotoUploadPanel
                  photos={photos}
                  onPhotosChange={setPhotos}
                  onEagerUpload={handleEagerUpload}
                  showDescriptions={false}
                  disabled={isSubmitting || isUploading}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploading || !rootCause.trim() || !resolutionNotes.trim()}
                className="flex-1"
              >
                {isSubmitting ? 'Resolving...' : 'Resolve Issue'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
