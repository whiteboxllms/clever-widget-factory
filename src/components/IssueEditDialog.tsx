import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, ImagePlus, X } from "lucide-react";
import { useImageUpload, ImageUploadResult } from "@/hooks/useImageUpload";
import { BaseIssue } from "@/types/issues";

interface IssueEditDialogProps {
  issue: BaseIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onUpdate: (issueId: string, updates: Partial<BaseIssue>) => Promise<boolean>;
}

export function IssueEditDialog({ issue, open, onOpenChange, onSuccess, onUpdate }: IssueEditDialogProps) {
  const [description, setDescription] = useState("");
  const [damageAssessment, setDamageAssessment] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { uploadImages, isUploading } = useImageUpload();

  // Populate form when issue changes
  useEffect(() => {
    if (issue) {
      setDescription(issue.description || "");
      setDamageAssessment(issue.damage_assessment || "");
      setExistingImages(issue.report_photo_urls || []);
      setSelectedImages([]);
    }
  }, [issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !issue) return;

    setIsSubmitting(true);
    try {
      let photoUrls = [...existingImages];
      
      // Upload new images if any are selected
      if (selectedImages.length > 0) {
        try {
          const uploadResults = await uploadImages(selectedImages, {
            bucket: 'tool-resolution-photos',
            generateFileName: (file, index) => `issue-edit-${issue.id}-${Date.now()}-${index || 1}-${file.name}`
          });
          
          const newUrls = Array.isArray(uploadResults) 
            ? uploadResults.map(result => result.url)
            : [uploadResults.url];
          
          photoUrls = [...photoUrls, ...newUrls];
        } catch (error) {
          console.error('Failed to upload images:', error);
          setIsSubmitting(false);
          return;
        }
      }

      const updates: Partial<BaseIssue> = {
        description: description.trim(),
        damage_assessment: damageAssessment || undefined,
        report_photo_urls: photoUrls
      };

      await onUpdate(issue.id, updates);
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedImages(files);
  };

  const removeNewImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  if (!issue) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            <span>Edit Issue</span>
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="description">Issue Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  rows={3}
                  required
                />
              </div>


              <div>
                <Label htmlFor="damageAssessment">
                  What Happened?
                </Label>
                <Textarea
                  id="damageAssessment"
                  value={damageAssessment}
                  onChange={(e) => setDamageAssessment(e.target.value)}
                  placeholder="Please describe what you were doing when this occurred and any events that might have contributed to the issue..."
                  rows={3}
                />
              </div>


              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div className="space-y-3">
                  <Label>Current Photos</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {existingImages.map((url, index) => (
                      <div key={`existing-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`Existing photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Image Upload */}
              <div className="space-y-3">
                <Label>Add Photos</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="new-issue-photos"
                    />
                    <Label
                      htmlFor="new-issue-photos"
                      className="flex items-center gap-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-accent"
                    >
                      <ImagePlus className="h-4 w-4" />
                      Select Images
                    </Label>
                    {selectedImages.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedImages.length} new image{selectedImages.length > 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>

                  {/* New Image Previews */}
                  {selectedImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {selectedImages.map((file, index) => (
                        <div key={`new-${index}`} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`New preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeNewImage(index)}
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <div className="absolute bottom-1 left-1 text-xs bg-background/80 rounded px-1">
                            {file.name.substring(0, 12)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!description.trim() || isSubmitting || isUploading}
                >
                  {isUploading ? "Uploading..." : isSubmitting ? "Updating..." : "Update Issue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
