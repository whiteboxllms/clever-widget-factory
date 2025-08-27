import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Paperclip, 
  Calendar as CalendarIcon, 
  Plus,
  X,
  Wrench,
  Clock,
  AlertCircle,
  Package
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { LexicalEditor } from './LexicalEditor';
import { AssetSelector } from './AssetSelector';
import { StockSelector } from './StockSelector';
import { cn } from "@/lib/utils";
import { BaseAction, Profile, ActionCreationContext } from "@/types/actions";

interface UnifiedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: BaseAction;
  context?: ActionCreationContext;
  profiles: Profile[];
  onActionSaved: () => void;
  isCreating?: boolean;
}

export function UnifiedActionDialog({
  open,
  onOpenChange,
  action,
  context,
  profiles,
  onActionSaved,
  isCreating = false
}: UnifiedActionDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<BaseAction>>({});
  const [newTool, setNewTool] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState<Date | undefined>();
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [currentContextType, setCurrentContextType] = useState<string | null>(null);
  
  const { uploadImages, isUploading } = useImageUpload();

  // Initialize form data when dialog opens - preserve state for same session
  useEffect(() => {
    if (open) {
      const actionId = action?.id || null;
      const contextType = context?.type || null;
      
      // Check if we're opening the same action/context or a different one
      const isSameSession = actionId === currentActionId && contextType === currentContextType;
      
      // Only reset form if it's a different action/context or first time opening
      if (!isSameSession || !isFormInitialized) {
        if (action && !isCreating) {
          // Editing existing action
          setFormData({
            ...action,
            required_tools: action.required_tools || [],
            required_stock: action.required_stock || [],
            attachments: action.attachments || []
          });
          if (action.estimated_duration) {
            setEstimatedDate(new Date(action.estimated_duration));
          }
        } else if (context?.prefilledData) {
          // Creating new action with context
          setFormData({
            ...context.prefilledData,
            required_tools: context.prefilledData.required_tools || [],
            required_stock: context.prefilledData.required_stock || [],
            attachments: context.prefilledData.attachments || []
          });
        } else {
          // Default new action
          setFormData({
            title: '',
            description: '',
            plan: '',
            observations: '',
            assigned_to: null,
            status: 'not_started',
            required_tools: [],
            required_stock: [],
            attachments: []
          });
        }
        
        setIsFormInitialized(true);
        setCurrentActionId(actionId);
        setCurrentContextType(contextType);
      }
    } else {
      // Reset tracking when dialog closes
      setIsFormInitialized(false);
      setCurrentActionId(null);
      setCurrentContextType(null);
    }
  }, [open, action?.id, context?.type, isCreating]);

  const getDialogTitle = () => {
    if (!isCreating && action) {
      return `Edit Action: ${action.title || 'Untitled Action'}`;
    }
    
    if (context?.type === 'issue') {
      return 'Create Action from Issue';
    }
    if (context?.type === 'mission') {
      return 'Create Mission Action';
    }
    if (context?.type === 'asset') {
      return 'Create Asset Action';
    }
    return 'Create New Action';
  };

  const showIssueReference = () => {
    return formData.linked_issue_id || formData.issue_reference;
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadResults = await uploadImages(fileArray, {
        bucket: 'mission-attachments'
      });
      
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      setFormData(prev => ({
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
  };

  const addTool = () => {
    if (newTool.trim() && !(formData.required_tools || []).includes(newTool.trim())) {
      setFormData(prev => ({
        ...prev,
        required_tools: [...(prev.required_tools || []), newTool.trim()]
      }));
      setNewTool('');
    }
  };

  const removeTool = (tool: string) => {
    setFormData(prev => ({
      ...prev,
      required_tools: (prev.required_tools || []).filter(t => t !== tool)
    }));
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title?.trim()) {
      toast({
        title: "Error",
        description: "Please enter an action title",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const estimatedDuration = estimatedDate ? estimatedDate.toISOString() : null;

      const actionData: any = {
        title: formData.title.trim(),
        description: formData.description || null,
        plan: formData.plan || null,
        observations: formData.observations || null,
        assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
        estimated_duration: estimatedDuration,
        required_tools: formData.required_tools || [],
        required_stock: formData.required_stock || [],
        attachments: formData.attachments || [],
        mission_id: formData.mission_id || null,
        asset_id: formData.asset_id || null,
        linked_issue_id: formData.linked_issue_id || null,
        issue_reference: formData.issue_reference || null,
        status: formData.status || 'not_started'
      };


      if (isCreating || !action?.id) {
        // Creating new action
        const { error } = await supabase
          .from('actions')
          .insert(actionData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Action created successfully"
        });
      } else {
        // Updating existing action
        const { error } = await supabase
          .from('actions')
          .update(actionData)
          .eq('id', action.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Action updated successfully"
        });
      }

      onActionSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving action:', error);
      toast({
        title: "Error",
        description: "Failed to save action",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Issue Reference Display */}
          {showIssueReference() && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <h4 className="font-semibold text-sm">Linked Issue Reference</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.issue_reference || `Issue ID: ${formData.linked_issue_id}`}
              </p>
            </div>
          )}

          {/* Action Title */}
          <div>
            <Label htmlFor="actionTitle" className="text-sm font-medium">
              Action Title *
            </Label>
            <Input
              id="actionTitle"
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Short description of what must be done"
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the action..."
              className="mt-1"
              rows={3}
            />
          </div>


          {/* Assigned To and Estimated Completion Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignedTo" className="text-sm font-medium">
                Assigned To
              </Label>
              <Select 
                value={formData.assigned_to || 'unassigned'} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  assigned_to: value === 'unassigned' ? null : value 
                }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map((profile) => (
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
                      !estimatedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {estimatedDate ? (
                      format(estimatedDate, "PPP")
                    ) : (
                      <span>Pick a completion date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={estimatedDate}
                    onSelect={setEstimatedDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Assets and Stock Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assets */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <Wrench className="w-4 h-4" />
                Assets
              </Label>
              <AssetSelector
                selectedAssets={formData.required_tools || []}
                onAssetsChange={(assets) => setFormData(prev => ({ 
                  ...prev, 
                  required_tools: assets 
                }))}
              />
            </div>

            {/* Stock */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <Package className="w-4 h-4" />
                Stock
              </Label>
              <StockSelector
                selectedStock={formData.required_stock || []}
                onStockChange={(stock) => setFormData(prev => ({ 
                  ...prev, 
                  required_stock: stock 
                }))}
              />
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
                    value={formData.plan || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, plan: value }))}
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
                    value={formData.observations || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
                    placeholder="Document the implementation progress and observations..."
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

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
            {(formData.attachments || []).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {(formData.attachments || []).map((url, index) => (
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
              {isSubmitting ? (isCreating ? 'Creating...' : 'Saving...') : (isCreating ? 'Create Action' : 'Save Changes')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}