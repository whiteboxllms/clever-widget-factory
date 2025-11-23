import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useImageUpload } from "@/hooks/useImageUpload";
import { supabase } from '@/lib/client';
import { toast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Loader2, X } from "lucide-react";

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

interface ResolutionForm {
  root_cause: string;
  resolution_notes: string;
  resolution_photos: File[];
}

export function IssueResolutionDialog({ 
  issue, 
  open, 
  onOpenChange, 
  onSuccess 
}: IssueResolutionDialogProps) {
  const [form, setForm] = useState<ResolutionForm>({
    root_cause: '',
    resolution_notes: '',
    resolution_photos: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const { uploadImages, isUploading } = useImageUpload();
  const organizationId = useOrganizationId();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setForm(prev => ({ ...prev, resolution_photos: files }));
    
    // Create preview URLs
    const urls = files.map(file => URL.createObjectURL(file));
    setPhotoPreviewUrls(urls);
  };

  const removePhoto = (index: number) => {
    const newFiles = form.resolution_photos.filter((_, i) => i !== index);
    const newUrls = photoPreviewUrls.filter((_, i) => i !== index);
    
    // Revoke the removed URL to prevent memory leaks
    URL.revokeObjectURL(photoPreviewUrls[index]);
    
    setForm(prev => ({ ...prev, resolution_photos: newFiles }));
    setPhotoPreviewUrls(newUrls);
  };

  const resetForm = () => {
    setForm({
      root_cause: '',
      resolution_notes: '',
      resolution_photos: []
    });
    // Clean up preview URLs
    photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setPhotoPreviewUrls([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!issue) return;

    // Validation
    if (!form.root_cause.trim()) {
      toast({
        title: "Root cause required",
        description: "Please provide the root cause of the issue.",
        variant: "destructive"
      });
      return;
    }

    if (!form.resolution_notes.trim()) {
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
      if (form.resolution_photos.length > 0) {
        const uploadResults = await uploadImages(form.resolution_photos, {
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
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          status: 'resolved',
          resolved_by: (await supabase.auth.getUser()).data.user?.id,
          resolved_at: new Date().toISOString(),
          root_cause: form.root_cause,
          resolution_notes: form.resolution_notes,
          resolution_photo_urls: photoUrls
        })
        .eq('id', issue.id);

      if (updateError) throw updateError;

      // Create history record
      const { error: historyError } = await supabase
        .from('issue_history')
        .insert({
          issue_id: issue.id,
          old_status: 'active',
          new_status: 'resolved',
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: `Resolved: ${form.resolution_notes}`,
        });

      if (historyError) throw historyError;

      toast({
        title: "Issue resolved",
        description: "The issue has been marked as resolved with documentation."
      });

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
              value={form.root_cause}
              onChange={(e) => setForm(prev => ({ ...prev, root_cause: e.target.value }))}
              placeholder="What was the underlying cause of this issue?"
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="resolution_notes">Resolution Method *</Label>
            <Textarea
              id="resolution_notes"
              value={form.resolution_notes}
              onChange={(e) => setForm(prev => ({ ...prev, resolution_notes: e.target.value }))}
              placeholder="How was the issue resolved? What steps were taken?"
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="resolution_photos">Resolution Photos (Optional)</Label>
            <input
              id="resolution_photos"
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload photos showing the resolved issue (optional)
            </p>
            
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={url} 
                      alt={`Resolution photo ${index + 1}`}
                      className="w-full h-20 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 text-xs"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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