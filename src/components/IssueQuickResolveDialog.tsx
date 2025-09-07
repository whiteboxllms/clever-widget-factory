import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Paperclip, CheckCircle } from 'lucide-react';

import { BaseIssue } from "@/types/issues";

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
  const { uploadImages, isUploading } = useImageUpload();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rootCause: '',
    resolutionNotes: '',
    photos: [] as string[]
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadResults = await uploadImages(fileArray, {
        bucket: 'tool-issue-photos'
      });
      
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploadedUrls]
      }));
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} photo(s) uploaded successfully`
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: "Error",
        description: "Failed to upload photos",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rootCause.trim() || !formData.resolutionNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide both root cause and resolution notes",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          status: 'resolved',
          root_cause: formData.rootCause,
          resolution_notes: formData.resolutionNotes,
          resolution_photo_urls: formData.photos,
          resolved_at: new Date().toISOString()
        })
        .eq('id', issue.id);

      if (updateError) throw updateError;

      // Log the resolution in history
      const organizationId = useOrganizationId();
      const { error: historyError } = await supabase
        .from('issue_history')
        .insert({
          issue_id: issue.id,
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          old_status: issue.status,
          new_status: 'resolved',
          field_changed: 'status',
          notes: `Issue resolved. Root cause: ${formData.rootCause}. Resolution: ${formData.resolutionNotes}`,
          organization_id: organizationId
        });

      if (historyError) throw historyError;

      toast({
        title: "Issue Resolved",
        description: "The issue has been marked as resolved successfully"
      });

      // Reset form
      setFormData({
        rootCause: '',
        resolutionNotes: '',
        photos: []
      });
      
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

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
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
                value={formData.rootCause}
                onChange={(e) => setFormData(prev => ({ ...prev, rootCause: e.target.value }))}
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
                value={formData.resolutionNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, resolutionNotes: e.target.value }))}
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
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photoUpload"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('photoUpload')?.click()}
                  disabled={isUploading}
                  className="w-full"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload Resolution Photos'}
                </Button>
              </div>
              
              {/* Display uploaded photos */}
              {formData.photos.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-muted-foreground">Uploaded photos:</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.photos.map((url, index) => (
                      <div key={index} className="relative">
                        <img
                          src={url}
                          alt={`Resolution photo ${index + 1}`}
                          className="h-16 w-16 object-cover rounded border cursor-pointer"
                          onClick={() => window.open(url, '_blank')}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                disabled={isSubmitting || isUploading || !formData.rootCause.trim() || !formData.resolutionNotes.trim()}
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