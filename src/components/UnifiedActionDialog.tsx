import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { 
  Paperclip, 
  Calendar as CalendarIcon, 
  Plus,
  X,
  Wrench,
  Clock,
  AlertCircle,
  Package,
  Trash2,
  CheckCircle,
  Target
} from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAuth } from "@/hooks/useAuth";
import TiptapEditor from './TiptapEditor';
import { ActionImplementationUpdates } from './ActionImplementationUpdates';
import { AssetSelector } from './AssetSelector';
import { StockSelector } from './StockSelector';
import { MultiParticipantSelector } from './MultiParticipantSelector';
import { cn, sanitizeRichText, getActionBorderStyle } from "@/lib/utils";
import { BaseAction, Profile, ActionCreationContext } from "@/types/actions";
import { autoCheckinToolsForAction } from '@/lib/autoToolCheckout';

interface UnifiedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: BaseAction;
  context?: ActionCreationContext;
  profiles: Profile[];
  onActionSaved: (saved?: BaseAction) => void;
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
  const { isLeadership } = useAuth();
  const organizationId = useOrganizationId();
  const [formData, setFormData] = useState<Partial<BaseAction>>({});
  const [missionData, setMissionData] = useState<any>(null);
  const [newTool, setNewTool] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState<Date | undefined>();
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [currentContextType, setCurrentContextType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isInImplementationMode, setIsInImplementationMode] = useState(false);
  
  // Compute the default tab based on action state
  const getDefaultTab = () => {
    if (action && !isCreating) {
      const policyToCheck = action.policy || '';
      const hasPolicy = policyToCheck && 
        policyToCheck.trim() && 
        policyToCheck !== '<p></p>' && 
        policyToCheck !== '<p><br></p>' &&
        policyToCheck !== '<p>&nbsp;</p>';
      const hasPlanCommitment = action.plan_commitment === true;
      
      // Use same logic as border colors:
      // Blue border: hasPolicy && hasPlanCommitment (ready to work)
      // Yellow border: hasImplementationUpdates && hasPolicy && hasPlanCommitment (implementation in progress)
      const shouldDefaultToImplementation = hasPolicy && hasPlanCommitment;
      
      console.log('Computing default tab:', {
        actionPolicy: action.policy,
        hasPolicy,
        hasPlanCommitment,
        shouldDefaultToImplementation,
        defaultTab: shouldDefaultToImplementation ? 'observations' : 'plan'
      });
      
      return shouldDefaultToImplementation ? 'observations' : 'plan';
    }
    return 'plan';
  };
  
  const { uploadFiles, isUploading } = useFileUpload();

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
          console.log('UnifiedActionDialog: Setting form data for action:', action.id, 'with policy:', action.policy);
          console.log('UnifiedActionDialog: Full action object:', action);
          setFormData({
            ...action,
            required_tools: action.required_tools || [],
            required_tool_serial_numbers: action.required_tool_serial_numbers || [],
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
            required_tool_serial_numbers: context.prefilledData.required_tool_serial_numbers || [],
            required_stock: context.prefilledData.required_stock || [],
            attachments: context.prefilledData.attachments || []
          });
        } else {
          // Default new action
          setFormData({
            title: '',
            description: '',
            policy: '',
            assigned_to: null,
            status: 'not_started',
            plan_commitment: false,
            required_tools: [],
            required_tool_serial_numbers: [],
            required_stock: [],
            attachments: []
          });
        }
        
        setIsFormInitialized(true);
        setCurrentActionId(actionId);
        setCurrentContextType(contextType);
        
        // Check if action is in implementation mode
        if (action && !isCreating) {
          checkImplementationMode(action);
        } else {
          setIsInImplementationMode(false);
        }
      }
    } else {
      // Reset tracking when dialog closes
      setIsFormInitialized(false);
      setCurrentActionId(null);
      setCurrentContextType(null);
    }
  }, [open, action?.id, context?.type, isCreating]);

  // Fetch mission data when action has mission_id
  useEffect(() => {
    const fetchMissionData = async () => {
      if (formData.mission_id) {
        try {
          const { data, error } = await supabase
            .from('missions')
            .select('id, title, problem_statement, mission_number, status')
            .eq('id', formData.mission_id)
            .single();

          if (error) {
            console.error('Error fetching mission data:', error);
            return;
          }

          setMissionData(data);
        } catch (error) {
          console.error('Error fetching mission data:', error);
        }
      } else {
        setMissionData(null);
      }
    };

    fetchMissionData();
  }, [formData.mission_id]);

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

  // Helper to check if there are implementation updates
  const hasImplementationNotes = async () => {
    if (!action?.id) return false;
    
    try {
      const { data: updates } = await supabase
        .from('action_implementation_updates')
        .select('id')
        .eq('action_id', action.id)
        .limit(1);
      
      return updates && updates.length > 0;
    } catch (error) {
      console.error('Error checking implementation updates:', error);
      return false;
    }
  };

  const checkImplementationMode = async (action: BaseAction) => {
    if (!action?.id) {
      setIsInImplementationMode(false);
      return;
    }
    
    try {
      const { data: updates } = await supabase
        .from('action_implementation_updates')
        .select('id')
        .eq('action_id', action.id)
        .limit(1);
      
      setIsInImplementationMode(updates && updates.length > 0);
    } catch (error) {
      console.error('Error checking implementation mode:', error);
      setIsInImplementationMode(false);
    }
  };

  const handleReadyForReview = async () => {
    if (!action?.id) return;
    
    if (!(await hasImplementationNotes())) {
      toast({
        title: "Error",
        description: "Please add at least one implementation update before marking as ready for review",
        variant: "destructive"
      });
      return;
    }

    setIsCompleting(true);
    
    try {
      // Get the current user for inventory logging
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        throw new Error('User must be authenticated to complete actions');
      }

      // Process required stock consumption if any
      const requiredStock = formData.required_stock || [];
      if (requiredStock.length > 0) {
        await processStockConsumption(requiredStock, action.id, currentUser.id);
      }

      // First save any pending changes
      const updateData = {
        title: formData.title,
        description: formData.description,
        policy: formData.policy,
        assigned_to: formData.assigned_to,
        estimated_duration: formData.estimated_duration,
        required_tools: formData.required_tools,
        required_stock: formData.required_stock,
        attachments: formData.attachments,
        updated_at: new Date().toISOString()
      };

      const { error: saveError } = await supabase
        .from('actions')
        .update(updateData)
        .eq('id', action.id);

      if (saveError) throw saveError;

      // Then mark as completed
      const { error: completeError } = await supabase
        .from('actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', action.id);

      if (completeError) throw completeError;

      // Auto-checkin tools
      try {
        await autoCheckinToolsForAction({
          actionId: action.id,
          organizationId: organizationId,
          checkinReason: 'Action completed',
          notes: 'Auto-checked in when action was completed'
        });
      } catch (checkinError) {
        console.error('Auto-checkin failed:', checkinError);
      }

      toast({
        title: "Success",
        description: "Action completed and stock consumption recorded"
      });

      onActionSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error completing action:', error);
      toast({
        title: "Error",
        description: "Failed to complete action and record stock usage",
        variant: "destructive"
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const processStockConsumption = async (requiredStock: any[], actionId: string, userId: string) => {
    for (const stockItem of requiredStock) {
      try {
        // Get current quantity and update parts table
        const { data: partData, error: fetchError } = await supabase
          .from('parts')
          .select('current_quantity')
          .eq('id', stockItem.part_id)
          .single();

        if (fetchError) {
          console.error(`Failed to fetch part ${stockItem.part_id}:`, fetchError);
          throw new Error(`Part with ID ${stockItem.part_id} not found or access denied`);
        }

        const newQuantity = Math.max(0, (partData?.current_quantity || 0) - stockItem.quantity);
        
        const { error: updateError } = await supabase
          .from('parts')
          .update({ current_quantity: newQuantity })
          .eq('id', stockItem.part_id);

        if (updateError) throw updateError;

        // Log to parts_history table
        const { error: historyError } = await supabase
          .from('parts_history')
          .insert({
            part_id: stockItem.part_id,
            change_type: 'quantity_remove',
            old_quantity: partData?.current_quantity || 0,
            new_quantity: newQuantity,
            quantity_change: -stockItem.quantity,
            changed_by: userId,
            change_reason: `Used for action: ${formData.title} - ${stockItem.quantity} ${stockItem.part_name}`,
            organization_id: organizationId
          });

        if (historyError) {
          console.error('Error creating parts history:', historyError);
        }
      } catch (error) {
        console.error(`Error processing stock item ${stockItem.part_id}:`, error);
        throw error;
      }
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const fileArray = Array.from(files);
      const uploadResults = await uploadFiles(fileArray, {
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

  const handleDelete = async () => {
    if (!action?.id) return;
    
    if (!confirm('Are you sure you want to delete this action? This cannot be undone.')) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('actions')
        .delete()
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Action deleted successfully"
      });

      onActionSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting action:', error);
      toast({
        title: "Error",
        description: "Failed to delete action",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
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

    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization context not available",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const estimatedDuration = estimatedDate ? estimatedDate.toISOString() : null;

      // Normalize rich text content
      const normalizedPolicy = sanitizeRichText(formData.policy);
      
      const actionStatus = formData.status || 'not_started';

      const actionData: any = {
        title: formData.title.trim(),
        description: formData.description || null,
        policy: normalizedPolicy,
        assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
        participants: formData.participants || [],
        estimated_duration: estimatedDuration,
        required_tools: formData.required_tools || [],
        required_tool_serial_numbers: formData.required_tool_serial_numbers || [],
        required_stock: formData.required_stock || [],
        attachments: formData.attachments || [],
        mission_id: formData.mission_id || null,
        asset_id: formData.asset_id || null,
        linked_issue_id: formData.linked_issue_id || null,
        issue_reference: formData.issue_reference || null,
        status: actionStatus,
        plan_commitment: formData.plan_commitment || false,
        organization_id: organizationId
      };



      if (isCreating || !action?.id) {
        // Creating new action
        const { data, error } = await supabase
          .from('actions')
          .insert(actionData)
          .select('*')
          .single();

        if (error) throw error;

        // After insert, create planned checkouts for any buffered tools (serials in formData.required_tool_serial_numbers)
        try {
          if ((formData.required_tool_serial_numbers || []).length > 0) {
            // Resolve serials to tool rows
            const { data: tools } = await supabase
              .from('tools')
              .select('id, serial_number')
              .in('serial_number', formData.required_tool_serial_numbers || []);

            // Get current user for user fields
            const { data: { user } } = await supabase.auth.getUser();

            const createdAction: { id: string; title?: string | null } = { id: (data as unknown as { id: string }).id, title: (data as unknown as { title?: string | null }).title };

            for (const serial of (formData.required_tool_serial_numbers || [])) {
              const tool = tools?.find(t => t.serial_number === serial);
              if (!tool || !user) continue;

              // Fetch action title for intended usage
              const actionTitle = createdAction.title || 'Action';

              // Create planned checkout for each buffered serial
              await supabase
                .from('checkouts')
                .insert({
                  tool_id: tool.id,
                  user_id: user.id,
                  user_name: user.user_metadata?.full_name || 'Unknown User',
                  intended_usage: actionTitle,
                  notes: `Planned for action: ${actionTitle}`,
                  checkout_date: null,
                  is_returned: false,
                  action_id: createdAction.id,
                  organization_id: organizationId
                } as any);
            }
          }
        } catch (planErr) {
          console.error('Failed to create planned checkouts after action insert:', planErr);
        }

        toast({
          title: "Success",
          description: "Action created successfully"
        });
        onActionSaved(data as unknown as BaseAction);
      } else {
        // Updating existing action
        const { data, error } = await supabase
          .from('actions')
          .update(actionData)
          .eq('id', action.id)
          .select('*')
          .single();

        if (error) throw error;

        toast({
          title: "Success",
          description: "Action updated successfully"
        });
        onActionSaved(data as unknown as BaseAction);
      }
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

  // Get border styling based on current form data
  const borderStyle = getActionBorderStyle({
    status: action?.status || formData.status || 'not_started',
    policy: formData.policy,
    assigned_to: formData.assigned_to,
    plan_commitment: formData.plan_commitment,
    implementation_update_count: action?.implementation_update_count
  });


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto",
        borderStyle.borderColor
      )}>
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            {isCreating ? 'Create a new action with details and assignments' : 'Edit action details and assignments'}
          </DialogDescription>
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

          {/* Mission Context Display */}
          {missionData && (
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Mission Context</h4>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Mission #{missionData.mission_number}: {missionData.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {missionData.problem_statement}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {missionData.status}
                  </Badge>
                </div>
              </div>
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
            <Label htmlFor="description">Existing State</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Provide some background."
              className="mt-1"
              rows={3}
            />
          </div>


          {/* Assigned To, Participants, and Estimated Completion Date */}
          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="participants" className="text-sm font-medium">
                Participants
              </Label>
              <div className="mt-1">
                <MultiParticipantSelector
                  participants={formData.participants || []}
                  onParticipantsChange={(participants) => setFormData(prev => ({ ...prev, participants }))}
                  profiles={profiles}
                  assigneeId={formData.assigned_to}
                />
              </div>
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

            {/* Plan Commitment Toggle - Only show when assigned and user is leadership */}
            {formData.assigned_to && formData.assigned_to !== 'unassigned' && isLeadership && (
              <div className="col-span-3 pt-2 border-t border-border">
                <div className="flex items-start space-x-3">
                  <Switch
                    id="plan-commitment"
                    checked={formData.plan_commitment || false}
                    onCheckedChange={async (checked) => {
                      setFormData({
                        ...formData, 
                        plan_commitment: checked,
                        status: checked ? 'in_progress' : 'not_started'
                      });
                      
                      // Create implementation update when toggled
                      if (action?.id) {
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (user) {
                            const updateText = checked 
                              ? "Leadership approved this action plan and committed to implementation."
                              : "Leadership withdrew approval of this action plan.";
                            
                            await supabase
                              .from('action_implementation_updates')
                              .insert({
                                action_id: action.id,
                                update_text: updateText,
                                updated_by: user.id
                              });
                          }
                        } catch (error) {
                          console.error('Error creating implementation update:', error);
                        }
                      }
                    }}
                  />
                  <Label 
                    htmlFor="plan-commitment" 
                    className="text-sm leading-5 cursor-pointer"
                  >
                    {(() => {
                      const assignee = profiles.find(p => p.user_id === formData.assigned_to);
                      const assigneeName = assignee?.full_name || 'The assignee';
                      return `${assigneeName} and leadership agreed to this action plan.`;
                    })()}
                  </Label>
                </div>
              </div>
            )}
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
                selectedAssets={formData.required_tool_serial_numbers || []}
                onAssetsChange={(assets) => setFormData(prev => ({ 
                  ...prev, 
                  required_tool_serial_numbers: assets 
                }))}
                actionId={action?.id}
                organizationId={organizationId}
                isInImplementationMode={isInImplementationMode}
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
          <Tabs value={activeTab || getDefaultTab()} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="plan">Policy</TabsTrigger>
              <TabsTrigger value="observations">Implementation</TabsTrigger>
            </TabsList>
            
            <TabsContent value="plan" className="mt-4">
              <div>
                <Label>Action Policy</Label>
                <div className="mt-2 border rounded-lg">
                 <TiptapEditor
                   key={`plan-${action?.id || 'new'}`}
                   value={formData.policy || ''}
                   onChange={(value) => setFormData(prev => ({ ...prev, policy: value }))}
                   placeholder="Describe the policy for this action..."
                 />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="observations" className="mt-4">
              {action?.id ? (
                <ActionImplementationUpdates
                  actionId={action.id}
                  profiles={profiles}
                  onUpdate={() => {
                    // Refresh the action data if needed
                    onActionSaved?.();
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Save the action first to add implementation updates</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Attachments */}
          <div>
            <Label className="text-sm font-medium">Attachments (Images & PDFs)</Label>
            <div className="mt-1">
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
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
                {isUploading ? 'Uploading...' : 'Upload Images & PDFs'}
              </Button>
            </div>
            
            {/* Display uploaded attachments */}
            {(formData.attachments || []).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {(formData.attachments || []).map((url, index) => {
                    const isPdf = url.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={index} className="relative">
                        {isPdf ? (
                          <div
                            className="h-16 w-16 flex items-center justify-center bg-muted rounded border cursor-pointer hover:bg-muted/80"
                            onClick={() => window.open(url, '_blank')}
                          >
                            <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Attachment ${index + 1}`}
                            className="h-16 w-16 object-cover rounded border cursor-pointer"
                            onClick={() => window.open(url, '_blank')}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0"
                        >
                          ×
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {!isCreating && action?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            {!isCreating && action?.id && action.status !== 'completed' && (
              <Button
                onClick={handleReadyForReview}
                disabled={isCompleting || isSubmitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isCompleting ? 'Marking Complete...' : 'Ready for Review'}
              </Button>
            )}
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