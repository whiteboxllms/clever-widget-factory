import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Edit } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { BaseIssue } from "@/types/issues";
import { useToast } from "@/hooks/use-toast";
import { PhotoUploadPanel, type PhotoItem } from '@/components/shared/PhotoUploadPanel';

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
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { uploadImages, isUploading } = useImageUpload();
  const { toast } = useToast();

  // Populate form when issue changes
  useEffect(() => {
    if (issue) {
      setDescription(issue.description || "");
      setDamageAssessment(issue.damage_assessment || "");
      // Map existing photo URLs to PhotoItem format
      const existingPhotos: PhotoItem[] = (issue.report_photo_urls || []).map((url, index) => ({
        id: crypto.randomUUID(),
        photo_url: url,
        photo_order: index,
        previewUrl: url,
        isExisting: true,
      }));
      setPhotos(existingPhotos);
    }
  }, [issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !issue) return;

    setIsSubmitting(true);
    try {
      // Collect existing photo URLs
      const existingUrls = photos
        .filter(p => p.isExisting && p.photo_url)
        .map(p => p.photo_url!);

      // Upload new photos
      const newPhotos = photos.filter(p => p.file && !p.isExisting);
      let newUrls: string[] = [];
      if (newPhotos.length > 0) {
        const files = newPhotos.map(p => p.file!);
        const uploadResults = await uploadImages(files, {
          bucket: 'tool-resolution-photos' as const,
          generateFileName: (file, index) => `issue-edit-${issue.id}-${Date.now()}-${index || 1}-${file.name}`
        });
        newUrls = Array.isArray(uploadResults)
          ? uploadResults.map(result => result.url)
          : [uploadResults.url];
      }

      const photoUrls = [...existingUrls, ...newUrls];

      const updates: Partial<BaseIssue> = {
        description: description.trim(),
        damage_assessment: damageAssessment || undefined,
        report_photo_urls: photoUrls
      };

      const success = await onUpdate(issue.id, updates);

      if (success) {
        onSuccess?.();
      } else {
        toast({
          title: "Update failed",
          description: "The issue could not be updated. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error updating issue:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
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
                  Damage Assessment (if applicable)
                </Label>
                <Textarea
                  id="damageAssessment"
                  value={damageAssessment}
                  onChange={(e) => setDamageAssessment(e.target.value)}
                  placeholder="Please describe what you were doing when this occurred and any events that might have contributed to the issue..."
                  rows={3}
                />
              </div>

              {/* Photos */}
              <div className="space-y-3">
                <Label>Photos</Label>
                <PhotoUploadPanel
                  photos={photos}
                  onPhotosChange={setPhotos}
                  showDescriptions={false}
                  disabled={isSubmitting || isUploading}
                />
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
