import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ImagePlus, X, Settings, Plus } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";
import { useToolIssues, useInventoryIssues } from "@/hooks/useGenericIssues";
import { CombinedAsset } from "@/hooks/useCombinedAssets";
import { BaseIssue } from "@/types/issues";
import { useImageUpload, ImageUploadResult } from "@/hooks/useImageUpload";

import { IssueEditDialog } from "./IssueEditDialog";
import { GenericIssueCard } from "./GenericIssueCard";
import { IssueQuickResolveDialog } from "./IssueQuickResolveDialog";
import { CreateIssueDialog } from "./CreateIssueDialog";


import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface IssueReportDialogProps {
  asset: CombinedAsset | Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Issue type utilities imported from centralized location

export function IssueReportDialog({ asset, open, onOpenChange, onSuccess }: IssueReportDialogProps) {
  const [description, setDescription] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<ImageUploadResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingIssue, setEditingIssue] = useState<BaseIssue | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Determine if this is a stock item or asset/tool
  const isStockItem = asset && 'type' in asset && asset.type === 'stock';
  const contextType = isStockItem ? 'inventory' : 'tool';
  
  // Use appropriate hooks based on asset type
  const { issues: toolIssues, isLoading: toolLoading, createIssue: createToolIssue, fetchIssues: fetchToolIssues, updateIssue: updateToolIssue } = useToolIssues(
    !isStockItem ? asset?.id || null : null
  );
  const { issues: stockIssues, isLoading: stockLoading, createIssue: createStockIssue, fetchIssues: fetchStockIssues, updateIssue: updateStockIssue } = useInventoryIssues(
    isStockItem ? asset?.id || null : null
  );
  
  // Use the appropriate data based on asset type
  const issues = isStockItem ? stockIssues : toolIssues;
  const isLoading = isStockItem ? stockLoading : toolLoading;
  const createIssue = isStockItem ? createStockIssue : createToolIssue;
  const fetchIssues = isStockItem ? fetchStockIssues : fetchToolIssues;
  const updateIssue = isStockItem ? updateStockIssue : updateToolIssue;
  
  const { uploadImages, isUploading } = useImageUpload();
  const organizationId = useOrganizationId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !asset) return;

    setIsSubmitting(true);
    try {
      let photoUrls: string[] = [];
      
      // Upload images if any are selected
      if (selectedImages.length > 0) {
        try {
          const uploadResults = await uploadImages(selectedImages, {
            bucket: 'tool-resolution-photos',
            generateFileName: (file, index) => `issue-report-${asset.id}-${Date.now()}-${index || 1}-${file.name}`
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
          context_type: contextType,
          context_id: asset.id,
          description,
          issue_type: 'general',
          
          report_photo_urls: photoUrls
        });

        // Reset form
        setDescription("");
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

  const handleEditIssue = (issue: BaseIssue) => {
    setEditingIssue(issue);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    await fetchIssues();
    setIsEditDialogOpen(false);
    setEditingIssue(null);
  };

  const handleResolveIssue = (issue: BaseIssue) => {
    setEditingIssue(issue);
    setIsResolveDialogOpen(true);
  };

  const handleRemoveIssue = async (issue: BaseIssue) => {
    try {
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          status: 'removed'
        })
        .eq('id', issue.id);

      if (updateError) throw updateError;

      const { error: historyError } = await supabase
        .from('issue_history')
        .insert({
          issue_id: issue.id,
          old_status: issue.status,
          new_status: 'removed',
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: 'Issue removed by contributor',
          organization_id: organizationId
        });

      if (historyError) throw historyError;

      toast({
        title: "Issue removed",
        description: "The issue has been removed from the tool."
      });

      await fetchIssues();
    } catch (error) {
      console.error('Error removing issue:', error);
      toast({
        title: "Error removing issue",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    }
  };

  // Issue type utilities now imported from centralized location

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <div className="flex items-baseline gap-2">
              <span>Manage Issues - {asset.name}</span>
              {!isStockItem && (asset as Tool).serial_number && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({(asset as Tool).serial_number})
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Issues */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Current Issues</CardTitle>
              {!showReportForm && (
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Issue
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading existing issues...</p>
              ) : (() => {
                const activeIssues = issues.filter(issue => issue.status !== 'resolved');
                return activeIssues.length > 0 ? (
                  <div className="space-y-3">
                     {activeIssues.map((issue) => (
                       <GenericIssueCard
                         key={issue.id}
                         issue={issue}
                         onResolve={() => handleResolveIssue(issue)}
                         onEdit={() => handleEditIssue(issue)}
                         onRefresh={fetchIssues}
                         showContext={false}
                         enableScorecard={true}
                         enableActions={true}
                       />
                     ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No active issues reported</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Resolved Issues */}
          {(() => {
            const resolvedIssues = issues.filter(issue => issue.status === 'resolved');
            return resolvedIssues.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Resolved Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {resolvedIssues.map((issue) => (
                      <GenericIssueCard
                        key={issue.id}
                        issue={issue}
                        onResolve={() => handleResolveIssue(issue)}
                        onEdit={() => handleEditIssue(issue)}
                        onRefresh={fetchIssues}
                        showContext={false}
                        enableScorecard={true}
                        enableActions={true}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null;
          })()}

          {/* Report New Issue Form (Collapsible) */}
          {showReportForm && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Report New Issue</CardTitle>
                <Button
                  onClick={() => setShowReportForm(false)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
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
                      onClick={() => setShowReportForm(false)}
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
          )}
        </div>

        {/* Edit Issue Dialog */}
        <IssueEditDialog
          issue={editingIssue}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onUpdate={updateIssue}
          onSuccess={handleEditSuccess}
        />

        {/* Resolve Issue Dialog */}
        <IssueQuickResolveDialog
          open={isResolveDialogOpen}
          onOpenChange={setIsResolveDialogOpen}
          issue={editingIssue}
          onSuccess={() => {
            fetchIssues();
            setIsResolveDialogOpen(false);
            setEditingIssue(null);
          }}
        />

        {/* Create Issue Dialog */}
        <CreateIssueDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          contextType={contextType}
          contextId={asset?.id}
          onSuccess={() => {
            fetchIssues();
            setIsCreateDialogOpen(false);
          }}
        />

      </DialogContent>
    </Dialog>
  );
}
