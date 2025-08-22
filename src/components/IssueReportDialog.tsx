import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bug, Wrench, Shield, CheckCircle, ImagePlus, X, Edit, Settings } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";
import { useToolIssues, ToolIssue } from "@/hooks/useToolIssues";
import { useImageUpload, ImageUploadResult } from "@/hooks/useImageUpload";
import { ToolIssuesSummary } from "./ToolIssuesSummary";
import { IssueEditDialog } from "./IssueEditDialog";

interface IssueReportDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const issueTypeIcons = {
  safety: Shield,
  efficiency: Wrench,
  cosmetic: Bug,
  preventative_maintenance: AlertTriangle,
  functionality: AlertTriangle,
  lifespan: Settings
};

const issueTypeColors = {
  safety: "bg-destructive text-destructive-foreground",
  efficiency: "bg-orange-500 text-white",
  cosmetic: "bg-blue-500 text-blue-foreground",
  preventative_maintenance: "bg-yellow-500 text-yellow-foreground",
  functionality: "bg-purple-500 text-white",
  lifespan: "bg-teal-500 text-white"
};

export function IssueReportDialog({ tool, open, onOpenChange, onSuccess }: IssueReportDialogProps) {
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState<"safety" | "efficiency" | "cosmetic" | "preventative_maintenance" | "functionality" | "lifespan">("efficiency");
  
  const [damageDuringUse, setDamageDuringUse] = useState(false);
  const [incidentDescription, setIncidentDescription] = useState("");
  const [efficiencyLoss, setEfficiencyLoss] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ImageUploadResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIssue, setEditingIssue] = useState<ToolIssue | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { issues, isLoading, createIssue, fetchIssues, updateIssue } = useToolIssues(tool?.id || null);
  const { uploadImages, isUploading } = useImageUpload();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !tool) return;

    setIsSubmitting(true);
    try {
      let photoUrls: string[] = [];
      
      // Upload images if any are selected
      if (selectedImages.length > 0) {
        try {
          const uploadResults = await uploadImages(selectedImages, {
            bucket: 'tool-resolution-photos',
            generateFileName: (file, index) => `issue-report-${tool.id}-${Date.now()}-${index || 1}-${file.name}`
          });
          
          if (Array.isArray(uploadResults)) {
            photoUrls = uploadResults.map(result => result.url);
          } else {
            photoUrls = [uploadResults.url];
          }
          setUploadedImages(Array.isArray(uploadResults) ? uploadResults : [uploadResults]);
        } catch (error) {
          console.error('Failed to upload images:', error);
          setIsSubmitting(false);
          return;
        }
      }

        await createIssue({
          description,
          issueType,
          damageAssessment: incidentDescription || undefined,
          efficiencyLoss: efficiencyLoss ? parseFloat(efficiencyLoss) : undefined,
          photoUrls
        });

        // Reset form
        setDescription("");
        setIssueType("efficiency");
        
        setDamageDuringUse(false);
        setIncidentDescription("");
        setEfficiencyLoss("");
        setSelectedImages([]);
        setUploadedImages([]);
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error reporting issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedImages(files);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditIssue = (issue: ToolIssue) => {
    setEditingIssue(issue);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    await fetchIssues();
    setIsEditDialogOpen(false);
    setEditingIssue(null);
  };

  if (!tool) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <div className="flex items-baseline gap-2">
              <span>Manage Issues - {tool.name}</span>
              {tool.serial_number && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({tool.serial_number})
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Issues Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading existing issues...</p>
              ) : issues.length > 0 ? (
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const IconComponent = issueTypeIcons[issue.issue_type];
                    return (
                      <div key={issue.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={issueTypeColors[issue.issue_type]}>
                              {issue.issue_type}
                            </Badge>
                          </div>
                          <p className="text-sm">{issue.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Reported {new Date(issue.reported_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditIssue(issue)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  No active issues reported
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report New Issue Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Report New Issue</CardTitle>
            </CardHeader>
            <CardContent>
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
                          <Settings className="h-4 w-4 text-teal-500" />
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

                {/* Damage During Use and Efficiency Loss */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                          <Label htmlFor="damageDuringUse" className="text-sm font-medium">
                            Did this happen while using the tool?
                          </Label>
                        <Switch
                          id="damageDuringUse"
                          checked={damageDuringUse}
                          onCheckedChange={setDamageDuringUse}
                        />
                      </div>
                    </CardContent>
                  </Card>

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
                </div>

                {damageDuringUse && (
                  <div>
                    <Label htmlFor="incidentDescription">
                      What Happened? *
                    </Label>
                    <Textarea
                      id="incidentDescription"
                      value={incidentDescription}
                      onChange={(e) => setIncidentDescription(e.target.value)}
                      placeholder="Please describe what you were doing when this occurred and any events that might have contributed to the issue..."
                      rows={3}
                      required={damageDuringUse}
                    />
                  </div>
                )}


                {/* Image Upload Section */}
                <div className="space-y-3">
                  <Label>Photos</Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                        id="issue-photos"
                      />
                      <Label
                        htmlFor="issue-photos"
                        className="flex items-center gap-2 px-3 py-2 border border-input rounded-md cursor-pointer hover:bg-accent"
                      >
                        <ImagePlus className="h-4 w-4" />
                        Select Images
                      </Label>
                      {selectedImages.length > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {selectedImages.length} image{selectedImages.length > 1 ? 's' : ''} selected
                        </span>
                      )}
                    </div>

                    {/* Image Previews */}
                    {selectedImages.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedImages.map((file, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-20 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeImage(index)}
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
                    {isUploading ? "Uploading..." : isSubmitting ? "Reporting..." : "Report Issue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Edit Issue Dialog */}
        <IssueEditDialog
          issue={editingIssue}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onUpdate={updateIssue}
          onSuccess={handleEditSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
