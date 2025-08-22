import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Shield, Wrench, Bug, AlertTriangle, ImagePlus, X } from "lucide-react";
import { useImageUpload, ImageUploadResult } from "@/hooks/useImageUpload";
import { ToolIssue } from "@/hooks/useToolIssues";

interface IssueEditDialogProps {
  issue: ToolIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onUpdate: (issueId: string, updates: Partial<ToolIssue>) => Promise<boolean>;
}

const issueTypeIcons = {
  safety: Shield,
  efficiency: Wrench,
  cosmetic: Bug,
  preventative_maintenance: AlertTriangle,
  functionality: AlertTriangle,
  lifespan: Edit
};

export function IssueEditDialog({ issue, open, onOpenChange, onSuccess, onUpdate }: IssueEditDialogProps) {
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState<"safety" | "efficiency" | "cosmetic" | "preventative_maintenance" | "functionality" | "lifespan">("efficiency");
  
  
  const [damageAssessment, setDamageAssessment] = useState("");
  const [efficiencyLoss, setEfficiencyLoss] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { uploadImages, isUploading } = useImageUpload();

  // Populate form when issue changes
  useEffect(() => {
    if (issue) {
      setDescription(issue.description || "");
      setIssueType(issue.issue_type || "efficiency");
      
      setDamageAssessment(issue.damage_assessment || "");
      setEfficiencyLoss(issue.efficiency_loss_percentage?.toString() || "");
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

      const updates: Partial<ToolIssue> = {
        description: description.trim(),
        issue_type: issueType,
        
        damage_assessment: damageAssessment || undefined,
        efficiency_loss_percentage: efficiencyLoss ? parseFloat(efficiencyLoss) : undefined,
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

  const IconComponent = issueTypeIcons[issue.issue_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            <span>Edit Issue</span>
            <Badge variant="secondary" className="ml-2">
              <IconComponent className="h-3 w-3 mr-1" />
              {issue.issue_type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="issueType">Issue Type *</Label>
                <Select value={issueType} onValueChange={(value: any) => setIssueType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="safety">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        Safety Issue
                      </div>
                    </SelectItem>
                    <SelectItem value="efficiency">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-orange-500" />
                        Efficiency
                      </div>
                    </SelectItem>
                    <SelectItem value="cosmetic">
                      <div className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-blue-500" />
                        Cosmetic
                      </div>
                    </SelectItem>
                    <SelectItem value="preventative_maintenance">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-purple-500" />
                        Preventative Maintenance
                      </div>
                    </SelectItem>
                    <SelectItem value="functionality">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-indigo-500" />
                        Functionality
                      </div>
                    </SelectItem>
                    <SelectItem value="lifespan">
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4 text-teal-500" />
                        Lifespan
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

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

              {/* Incident Description */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                      <Label htmlFor="damageDuringUse" className="text-sm font-medium">
                        Did this happen while using the tool?
                      </Label>
                    <Switch
                      id="damageDuringUse"
                      checked={false}
                      onCheckedChange={() => {}}
                      disabled
                    />
                  </div>
                </CardContent>
              </Card>

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

              {issueType === "efficiency" && (
                <div>
                  <Label htmlFor="efficiencyLoss">Efficiency Loss %</Label>
                  <Input
                    id="efficiencyLoss"
                    type="number"
                    min="0"
                    max="100"
                    value={efficiencyLoss}
                    onChange={(e) => setEfficiencyLoss(e.target.value)}
                    placeholder="e.g., 25"
                  />
                </div>
              )}

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
