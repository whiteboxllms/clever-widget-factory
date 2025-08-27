import { useState, useEffect } from 'react';
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Save, 
  X, 
  Clock, 
  Wrench, 
  FileText, 
  Users, 
  ChevronDown,
  Plus,
  Trash2,
  Paperclip,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { LexicalEditor } from './LexicalEditor';
import { IssueQuickResolveDialog } from './IssueQuickResolveDialog';
import { useImageUpload } from '@/hooks/useImageUpload';
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface Action {
  id: string;
  title: string;
  description?: string;
  plan?: string;
  observations?: string;
  assigned_to: string | null;
  status: string;
  mission_id: string;
  estimated_completion_date?: Date;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  attachments?: string[];
  issue_reference?: string;
  linked_issue_id?: string;
}

interface ActionDetailEditorProps {
  action: Action;
  profiles: Profile[];
  onSave: () => void; // Just call when save is complete
  onCancel: () => void;
  isCreating?: boolean;
}


export function ActionDetailEditor({ 
  action, 
  profiles, 
  onSave, 
  onCancel, 
  isCreating = false 
}: ActionDetailEditorProps) {
  const { toast } = useToast();
  const [editData, setEditData] = useState<Partial<Action>>({
    title: action.title,
    description: action.description || '',
    plan: action.plan || '',
    observations: action.observations || '',
    assigned_to: action.assigned_to,
    estimated_completion_date: action.estimated_completion_date,
    required_tools: action.required_tools || [],
    required_stock: action.required_stock || [],
    attachments: action.attachments || []
  });

  const [newTool, setNewTool] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [linkedIssue, setLinkedIssue] = useState(null);
  
  const { uploadImages, isUploading } = useImageUpload();

  useEffect(() => {
    const originalData = {
      title: action.title,
      description: action.description || '',
      plan: action.plan || '',
      observations: action.observations || '',
      assigned_to: action.assigned_to,
      estimated_completion_date: action.estimated_completion_date,
      required_tools: action.required_tools || [],
      required_stock: action.required_stock || [],
      attachments: action.attachments || []
    };

    const hasChanged = JSON.stringify(editData) !== JSON.stringify(originalData);
    setHasChanges(hasChanged);
  }, [editData, action]);

  // Fetch linked issue data
  useEffect(() => {
    const fetchLinkedIssue = async () => {
      if (action.linked_issue_id) {
        try {
          const { data, error } = await supabase
            .from('tool_issues')
            .select('*')
            .eq('id', action.linked_issue_id)
            .single();
          
          if (error) throw error;
          setLinkedIssue(data);
        } catch (error) {
          console.error('Error fetching linked issue:', error);
        }
      }
    };

    fetchLinkedIssue();
  }, [action.linked_issue_id]);

  const handleSave = async () => {
    if (!editData.title?.trim()) {
      return;
    }
    
    setIsSaving(true);
    console.log('ActionDetailEditor - Saving action data directly to database:', editData);
    
    try {
      // Convert date to ISO string for database storage
      const estimatedDuration = editData.estimated_completion_date ? 
        editData.estimated_completion_date.toISOString() : null;

      const actionData = {
        title: editData.title.trim(),
        description: editData.description || null,
        plan: editData.plan || null,
        observations: editData.observations || null,
        assigned_to: editData.assigned_to || null,
        estimated_duration: estimatedDuration,
        required_tools: editData.required_tools || [],
        attachments: editData.attachments || []
      };

      // Check if this is a new action (no ID or temporary ID) or existing action
      const isNewAction = isCreating || !action.id || action.id.startsWith('temp-');
      
      if (isNewAction) {
        // Creating new action
        const { error } = await supabase
          .from('actions')
          .insert({
            ...actionData,
            mission_id: action.mission_id,
            status: 'not_started'
          });

        if (error) throw error;
        
        toast({
          title: "Action created",
          description: `"${editData.title}" has been created successfully.`
        });
      } else {
        // Updating existing action
        const { error } = await supabase
          .from('actions')
          .update(actionData)
          .eq('id', action.id);

        if (error) throw error;
        
        toast({
          title: "Action updated",
          description: `"${editData.title}" has been updated successfully.`
        });
      }

      console.log('ActionDetailEditor - Direct save completed successfully');
      onSave(); // Notify parent that save is complete
    } catch (error) {
      console.error('ActionDetailEditor - Direct save failed:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save action. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteAction = async () => {
    if (!editData.observations?.trim()) {
      toast({
        title: "Implementation notes required",
        description: "Please add implementation notes before completing the action.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // First save any pending changes
      await handleSave();

      // Then mark the action as completed
      const { error } = await supabase
        .from('actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Action completed",
        description: `"${editData.title}" has been marked as completed.`
      });

      // Check if all actions for the linked issue are completed
      if (action.linked_issue_id) {
        const { data: allActions, error: actionsError } = await supabase
          .from('actions')
          .select('status')
          .eq('linked_issue_id', action.linked_issue_id);

        if (!actionsError && allActions) {
          const allCompleted = allActions.every(a => a.status === 'completed' || a.status === 'no_action_required');
          
          if (allCompleted) {
            // Mark the issue as resolved
            const { error: issueError } = await supabase
              .from('tool_issues')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolved_by: (await supabase.auth.getUser()).data.user?.id
              })
              .eq('id', action.linked_issue_id);

            if (!issueError) {
              toast({
                title: "Issue resolved",
                description: "All actions for this issue are completed. The issue has been automatically resolved."
              });
            }
          }
        }
      }

      onSave(); // Notify parent that save is complete
    } catch (error) {
      console.error('Error completing action:', error);
      toast({
        title: "Failed to complete action",
        description: error.message || "Failed to complete action. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNoActionRequired = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('actions')
        .update({
          status: 'no_action_required',
          completed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Marked as no action required",
        description: `"${editData.title}" has been marked as no action required.`
      });

      // Check if all actions for the linked issue are completed
      if (action.linked_issue_id) {
        const { data: allActions, error: actionsError } = await supabase
          .from('actions')
          .select('status')
          .eq('linked_issue_id', action.linked_issue_id);

        if (!actionsError && allActions) {
          const allCompleted = allActions.every(a => a.status === 'completed' || a.status === 'no_action_required');
          
          if (allCompleted) {
            // Mark the issue as resolved
            const { error: issueError } = await supabase
              .from('tool_issues')
              .update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
                resolved_by: (await supabase.auth.getUser()).data.user?.id
              })
              .eq('id', action.linked_issue_id);

            if (!issueError) {
              toast({
                title: "Issue resolved",
                description: "All actions for this issue are completed. The issue has been automatically resolved."
              });
            }
          }
        }
      }

      onSave(); // Notify parent that save is complete
    } catch (error) {
      console.error('Error marking action as no action required:', error);
      toast({
        title: "Failed to update action",
        description: error.message || "Failed to update action. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addTool = () => {
    if (newTool.trim() && !editData.required_tools?.includes(newTool.trim())) {
      setEditData(prev => ({
        ...prev,
        required_tools: [...(prev.required_tools || []), newTool.trim()]
      }));
      setNewTool('');
    }
  };

  const removeTool = (tool: string) => {
    setEditData(prev => ({
      ...prev,
      required_tools: prev.required_tools?.filter(t => t !== tool) || []
    }));
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {isCreating ? 'Create New Action' : 'Edit Action Details'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Phase selection removed - actions no longer have phases */}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Issue Reference Display */}
        {action.issue_reference && (
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Linked Issue Reference
                </h4>
                <p className="text-sm text-muted-foreground">{action.issue_reference}</p>
              </div>
              {action.linked_issue_id && (
                <Button
                  onClick={() => setShowResolveDialog(true)}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Resolve Issue
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Action Title *</Label>
            <Input
              id="title"
              value={editData.title || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter action title..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={editData.description || ''}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the action..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select 
                value={editData.assigned_to || 'unassigned'} 
                onValueChange={(value) => setEditData(prev => ({ 
                  ...prev, 
                  assigned_to: value === 'unassigned' ? null : value 
                }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map(profile => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimated_completion_date">
                <Clock className="w-4 h-4 inline mr-1" />
                Estimated Completion Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !editData.estimated_completion_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editData.estimated_completion_date ? (
                      format(editData.estimated_completion_date, "PPP")
                    ) : (
                      <span>Pick a completion date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editData.estimated_completion_date}
                    onSelect={(date) => setEditData(prev => ({ ...prev, estimated_completion_date: date }))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Required Assets */}
        <div className="grid grid-cols-2 gap-6">
          {/* Required Assets */}
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <Wrench className="w-4 h-4" />
              Required Assets
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  placeholder="Add an asset..."
                  onKeyPress={(e) => e.key === 'Enter' && addTool()}
                />
                <Button onClick={addTool} size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {editData.required_tools && editData.required_tools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editData.required_tools.map((tool, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {tool}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeTool(tool)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Required Stock */}
          <div>
            <Label className="flex items-center gap-1 mb-2">
              <Wrench className="w-4 h-4" />
              Required Stock
            </Label>
            <div className="space-y-2">
              <Button 
                onClick={() => {/* TODO: Open stock selector */}} 
                size="sm" 
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stock
              </Button>
              {editData.required_stock && editData.required_stock.length > 0 && (
                <div className="space-y-2">
                  {editData.required_stock.map((stock, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{stock.part_name} (Qty: {stock.quantity})</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditData(prev => ({
                            ...prev,
                            required_stock: prev.required_stock?.filter((_, i) => i !== index) || []
                          }));
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rich Text Content */}
        <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="observations">Implementation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="plan" className="mt-4">
            <div>
              <Label>Action Plan</Label>
              <div className="mt-2 border rounded-lg">
                <LexicalEditor
                  value={editData.plan || ''}
                  onChange={(value) => setEditData(prev => ({ ...prev, plan: value }))}
                  placeholder="Describe the plan for this action..."
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="observations" className="mt-4">
            <div>
              <Label>Implementation Notes</Label>
              <div className="mt-2 border rounded-lg">
                <LexicalEditor
                  value={editData.observations || ''}
                  onChange={(value) => setEditData(prev => ({ ...prev, observations: value }))}
                  placeholder="Document the implementation progress and observations..."
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Attachments */}
        <div>
          <Label className="text-sm font-medium">Photos and Documents</Label>
          <div className="mt-1">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                try {
                  const fileArray = Array.from(files);
                  const uploadResults = await uploadImages(fileArray, {
                    bucket: 'mission-attachments'
                  });
                  
                  const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
                  const uploadedUrls = resultsArray.map(result => result.url);
                  
                  setEditData(prev => ({
                    ...prev,
                    attachments: [...(prev.attachments || []), ...uploadedUrls]
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
              }}
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
          {editData.attachments && editData.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
              <div className="flex flex-wrap gap-2">
                {editData.attachments.map((url, index) => (
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
                      onClick={() => {
                        setEditData(prev => ({
                          ...prev,
                          attachments: prev.attachments?.filter((_, i) => i !== index) || []
                        }));
                      }}
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
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          
          <div className="flex gap-2">
            {!isCreating && action.status !== 'completed' && action.status !== 'no_action_required' && (
              <>
                <Button
                  onClick={handleNoActionRequired}
                  variant="outline"
                  disabled={isSaving}
                >
                  No Action Required
                </Button>
                <Button
                  onClick={handleCompleteAction}
                  disabled={!editData.observations?.trim() || isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Complete Action
                </Button>
              </>
            )}
            <Button 
              onClick={handleSave}
              disabled={!editData.title?.trim() || !hasChanges || isSaving}
            >
              <Save className="w-4 h-4 mr-1" />
              {isSaving ? 'Saving...' : (isCreating ? 'Create Action' : 'Save Changes')}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Issue Resolution Dialog */}
      {linkedIssue && (
        <IssueQuickResolveDialog
          open={showResolveDialog}
          onOpenChange={setShowResolveDialog}
          issue={linkedIssue}
          onSuccess={() => {
            setShowResolveDialog(false);
            toast({
              title: "Issue resolved",
              description: "The linked issue has been resolved successfully."
            });
          }}
        />
      )}
    </Card>
  );
}