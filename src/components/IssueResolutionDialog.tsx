import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useCognitoAuth";
import { apiService } from "@/lib/apiService";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Loader2 } from "lucide-react";
import { PhotoUploadPanel, type PhotoItem } from '@/components/shared/PhotoUploadPanel';

interface ToolIssue {
  id: string;
  description: string;
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'maintenance';
  reported_at: string;
  reported_by: string;
  blocks_checkout?: boolean;
}

interface IssueResolutionDialogProps {
  issue: ToolIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function IssueResolutionDialog({ 
  issue, 
  open, 
  onOpenChange, 
  onSuccess 
}: IssueResolutionDialogProps) {
  const [rootCause, setRootCause] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { uploadImages, isUploading } = useImageUpload();
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  const { user } = useAuth();

  const handleEagerUpload = useCallback(async (file: File) => {
    const result = await uploadImages(file, { bucket: 'tool-resolution-photos' });
    const r = Array.isArray(result) ? result[0] : result;
    return { url: r.url };
  }, [uploadImages]);

  const resetForm = () => {
    setRootCause('');
    setResolutionNotes('');
    setPhotos([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issue) return;

    if (!rootCause.trim()) {
      toast({
        title: "Root cause required",
        description: "Please provide the root cause of the issue.",
        variant: "destructive"
      });
      return;
    }

    if (!resolutionNotes.trim()) {
      toast({
        title: "Resolution notes required",
        description: "Please describe how the issue was resolved.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload resolution photos (optional)
      let photoUrls: string[] = [];
      const newPhotos = photos.filter(p => p.file && !p.photo_url);
      if (newPhotos.length > 0) {
        const files = newPhotos.map(p => p.file!);
        const uploadResults = await uploadImages(files, {
          bucket: 'tool-resolution-photos' as const,
          generateFileName: (file) => `resolution-${issue.id}-${Date.now()}-${file.name}`,
          maxSizeMB: 2,
          maxWidthOrHeight: 1920
        });

        photoUrls = Array.isArray(uploadResults) 
          ? uploadResults.map(result => result.url)
          : [uploadResults.url];
      }

      // Update issue as resolved
      await apiService.put(`/api/issues/${issue.id}`, {
        status: 'resolved',
        resolved_by: user?.userId,
        resolved_at: new Date().toISOString(),
        root_cause: rootCause,
        resolution_notes: resolutionNotes,
        resolution_photo_urls: photoUrls
      });

      // Create history record
      await apiService.post('/api/issue_history', {
        issue_id: issue.id,
        old_status: 'active',
        new_status: 'resolved',
        changed_by: user?.userId,
        notes: `Resolved: ${resolutionNotes}`,
      });

      toast({
        title: "Issue resolved",
        description: "The issue has been marked as resolved with documentation."
      });

      // Refresh asset issue flags so card highlights update
      queryClient.invalidateQueries({ queryKey: ['issues_asset_flags'] });

      resetForm();
      onOpenChange(false);
      onSuccess();

    } catch (error) {
      console.error('Error resolving issue:', error);
      toast({
        title: "Error resolving issue",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Issue Description</Label>
            <div className="p-3 bg-muted rounded-lg text-sm">
              {issue?.description}
            </div>
          </div>

          <div>
            <Label htmlFor="root_cause">Root Cause Analysis *</Label>
            <Textarea
              id="root_cause"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="What was the underlying cause of this issue?"
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="resolution_notes">Resolution Method *</Label>
            <Textarea
              id="resolution_notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="How was the issue resolved? What steps were taken?"
              rows={3}
              required
            />
          </div>

          <div>
            <Label>Resolution Photos (Optional)</Label>
            <PhotoUploadPanel
              photos={photos}
              onPhotosChange={setPhotos}
              onEagerUpload={handleEagerUpload}
              showDescriptions={false}
              disabled={isSubmitting || isUploading}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
            >
              {(isSubmitting || isUploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Issue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
