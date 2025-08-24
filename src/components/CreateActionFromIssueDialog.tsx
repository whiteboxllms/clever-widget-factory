import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Paperclip, Calendar } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ToolIssue {
  id: string;
  description: string;
  issue_type: string;
  status: string;
  reported_at: string;
  tool_id: string;
}

interface Mission {
  id: string;
  title: string;
  mission_number: number;
  status: string;
}

interface CreateActionFromIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: ToolIssue;
  onActionCreated: () => void;
}

export function CreateActionFromIssueDialog({
  open,
  onOpenChange,
  issue,
  onActionCreated
}: CreateActionFromIssueDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    details: '',
    attachments: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { uploadImages, isUploading } = useImageUpload();

  // Pre-fill form with issue data when dialog opens
  useEffect(() => {
    if (open && issue) {
      setFormData({
        title: `Resolve ${issue.issue_type} issue`,
        details: `Action needed to address issue: ${issue.description}`,
        attachments: []
      });
    }
  }, [open, issue]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadResults = await uploadImages(fileArray, {
        bucket: 'mission-attachments'
      });
      
      // Ensure uploadResults is always an array
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedUrls]
      }));
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} file(s) uploaded successfully`
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Failed to upload files",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an action title",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('mission_actions')
        .insert({
          title: formData.title,
          description: formData.details,
          mission_id: null,
          linked_issue_id: issue?.id,
          issue_reference: issue ? `Issue: ${issue.description}` : null,
          attachments: formData.attachments,
          status: 'not_started'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Action created successfully"
      });

      setFormData({
        title: '',
        details: '',
        attachments: []
      });
      
      onActionCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating action:', error);
      toast({
        title: "Error",
        description: "Failed to create action",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Action from Issue</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Issue Reference Display */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Linked Issue Reference</h4>
            <p className="text-sm text-muted-foreground">
              Issue #{issue.id.slice(0, 8)} - {issue.issue_type} - {issue.description}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs text-muted-foreground">
                Reported: {new Date(issue.reported_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Date Created (Display Only) */}
          <div>
            <Label className="text-sm font-medium">Date Created</Label>
            <div className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">
              {new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Action Title */}
          <div>
            <Label htmlFor="actionTitle" className="text-sm font-medium">
              Action Title *
            </Label>
            <Input
              id="actionTitle"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Short description of what must be done"
              className="mt-1"
            />
          </div>

          {/* Details */}
          <div>
            <Label htmlFor="actionDetails" className="text-sm font-medium">
              Details *
            </Label>
            <Textarea
              id="actionDetails"
              value={formData.details}
              onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
              placeholder="Explanation of why this action is needed based on the issue observation"
              className="mt-1"
              rows={4}
            />
          </div>


          {/* Attachments */}
          <div>
            <Label className="text-sm font-medium">Before, during and after photos</Label>
            <div className="mt-1">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="attachmentUpload"
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('attachmentUpload')?.click()}
                disabled={isUploading}
                className="w-full"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Photos/Documents'}
              </Button>
            </div>
            
            {/* Display uploaded attachments */}
            {formData.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.attachments.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="h-16 w-16 object-cover rounded border cursor-pointer"
                        onClick={() => window.open(url, '_blank')}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeAttachment(index)}
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
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="flex-1"
            >
              {isSubmitting ? 'Creating...' : 'Create Action'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}