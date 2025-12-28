import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { offlineMutationConfig, offlineQueryConfig } from '@/lib/queryConfig';
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
import { useToast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { apiService } from '@/lib/apiService';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';
import { missionsQueryKey } from '@/lib/queryKeys';
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
  Target,
  Flag,
  Copy
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useCognitoAuth";
import TiptapEditor from './TiptapEditor';
import { ActionImplementationUpdates } from './ActionImplementationUpdates';
import { AssetSelector } from './AssetSelector';
import { StockSelector } from './StockSelector';
import { MultiParticipantSelector } from './MultiParticipantSelector';
import { MissionSelector } from './MissionSelector';
import { ToolDetails } from './tools/ToolDetails';
import { StockDetails } from './StockDetails';
import { cn, sanitizeRichText, getActionBorderStyle } from "@/lib/utils";
import { BaseAction, Profile, ActionCreationContext } from "@/types/actions";
import { autoCheckinToolsForAction, activatePlannedCheckoutsIfNeeded } from '@/lib/autoToolCheckout';
import { generateActionUrl, copyToClipboard } from "@/lib/urlUtils";

interface UnifiedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId?: string;
  context?: ActionCreationContext;
  profiles: Profile[];
  onActionSaved: (saved?: BaseAction) => void;
  isCreating?: boolean;
}

export function UnifiedActionDialog({
  open,
  onOpenChange,
  actionId,
  context,
  profiles,
  onActionSaved,
  isCreating = false
}: UnifiedActionDialogProps) {
  // Debug: Track component lifecycle
  
  const queryClient = useQueryClient();
  
  // Look up action from cache using ID
  const cachedActions = queryClient.getQueryData(['actions']) as BaseAction[] | undefined;
  const action = actionId && cachedActions ? cachedActions.find(a => a.id === actionId) : undefined;
  const { toast } = useToast();
  const { isLeadership, user } = useAuth();
  const organizationId = useOrganizationId();
  const { members: organizationMembers = [] } = useOrganizationMembers();
  
  const saveActionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      // Use PUT for updates (when id exists), POST for creates
      if (actionData.id) {
        // For PUT requests, exclude id from body since it's in the URL path
        const { id, ...updateData } = actionData;
        const result = await apiService.put(`/actions/${id}`, updateData);
        return result.data;
      } else {
        const result = await apiService.post('/actions', actionData);
        return result.data;
      }
    },
    onSuccess: (data, variables) => {
      // Update specific action in cache instead of invalidating all
      const actionId = data?.id || action?.id;
      if (actionId) {
        queryClient.setQueryData(['actions'], (old: BaseAction[] | undefined) => {
          if (!old) return old;
          const index = old.findIndex(a => a.id === actionId);
          if (index === -1) {
            // New action - add to cache
            return [...old, { ...variables, ...data, id: actionId }];
          }
          // Update existing action
          const updated = [...old];
          updated[index] = { ...old[index], ...variables, ...data, id: actionId };
          return updated;
        });
      }
      // Also invalidate issue-specific actions cache if this action is linked to an issue
      if (variables.linked_issue_id) {
        queryClient.invalidateQueries({ queryKey: ['issue_actions', variables.linked_issue_id] });
      }
      const optimisticData = { ...variables, ...data, id: data?.id || action?.id };
      toast({
        title: "Success",
        description: isCreating || !action?.id ? "Action created successfully" : "Action updated successfully"
      });
      onActionSaved(optimisticData as unknown as BaseAction);
      // Don't close dialog if uploads are in progress or just completed
      if (!isUploading && !isLocalUploading && !uploadJustCompletedRef.current) {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      console.error('Error saving action:', error);
      toast({
        title: "Error",
        description: "Failed to save action",
        variant: "destructive"
      });
    },
    ...offlineMutationConfig,
  });
  

  const [formData, setFormData] = useState<Partial<BaseAction>>({});
  const [missionData, setMissionData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState<Date | undefined>();
  const [implementationUpdateCount, setImplementationUpdateCount] = useState<number>(0);
  const [isFormInitialized, setIsFormInitialized] = useState(false);
  const [storedActionId, setStoredActionId] = useState<string | null>(null);
  const [currentContextType, setCurrentContextType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [isInImplementationMode, setIsInImplementationMode] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMissionDialog, setShowMissionDialog] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Local uploading state set immediately when files are selected (before async operations)
  // This prevents dialog from closing on mobile before uploadImages sets its internal state
  const [isLocalUploading, setIsLocalUploading] = useState(false);
  // Track when uploads just completed to prevent accidental closes immediately after
  const uploadJustCompletedRef = useRef(false);

  const preferName = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('@')) return null;
    return trimmed;
  };

  const resolveUserFullName = () => {
    if (!user) return 'Unknown User';
    const metadataName = preferName((user as any)?.user_metadata?.full_name);
    if (metadataName) return metadataName;
    const cognitoName = preferName((user as any)?.name);
    if (cognitoName) return cognitoName;
    const member = organizationMembers.find(
      (m) => m.cognito_user_id === user.id || m.user_id === user.id
    );
    const memberName = preferName(member?.full_name);
    if (memberName) return memberName;
    return user.email || (user as any)?.username || 'Unknown User';
  };
  
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
      
      
      return shouldDefaultToImplementation ? 'observations' : 'plan';
    }
    return 'plan';
  };
  
  const { uploadImages, isUploading } = useImageUpload();

  // Initialize form data when dialog opens - preserve state for same session
  useEffect(() => {
    if (open) {
      const currentActionId = actionId || null;
      const contextType = context?.type || null;
      
      // Check if we're opening the same action/context or a different one
      const isSameSession = currentActionId === storedActionId && contextType === currentContextType;
      
      // Only reset form if it's a different action/context or first time opening
      if (!isSameSession || !isFormInitialized) {
        if (action && !isCreating) {
          // Editing existing action - update formData when action changes from cache
          setFormData(prev => {
            // Only update if this is a new session or attachments changed
            if (!isSameSession || (action.attachments?.length !== prev.attachments?.length)) {
              return {
                ...action,
                plan_commitment: action.plan_commitment || false,
                policy_agreed_at: action.policy_agreed_at || null,
                policy_agreed_by: action.policy_agreed_by || null,
                required_stock: action.required_stock || [],
                required_tools: action.required_tools || [],
                attachments: action.attachments || []
              };
            }
            return prev;
          });
          // Initialize implementation update count from action
          setImplementationUpdateCount(action.implementation_update_count || 0);
          if (action.estimated_duration) {
            setEstimatedDate(new Date(action.estimated_duration));
          } else {
            // Explicitly set to undefined if no estimated_duration exists
            setEstimatedDate(undefined);
          }
        } else if (context?.prefilledData) {
          // Creating new action with context
          setFormData({
            ...context.prefilledData,
            required_tools: context.prefilledData.required_tools || [],
            required_stock: context.prefilledData.required_stock || [],
            attachments: context.prefilledData.attachments || []
          });
          // Don't set default estimated completion date - explicitly set to undefined
          setEstimatedDate(undefined);
        } else {
          // Default new action
          setFormData({
            title: '',
            description: '',
            policy: '',
            assigned_to: null,
            status: 'not_started',
            plan_commitment: false,
            policy_agreed_at: null,
            policy_agreed_by: null,
            required_stock: [],
            attachments: []
          });
          // Don't set default estimated completion date - explicitly set to undefined
          setEstimatedDate(undefined);
        }
        
        setIsFormInitialized(true);
        setStoredActionId(currentActionId);
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
      setStoredActionId(null);
      setCurrentContextType(null);
    }
  }, [open, actionId, context?.type, isCreating]);

  // Update formData when action changes from cache (after refetch)
  useEffect(() => {
    if (action && !isCreating && isFormInitialized && !isUploading && !isLocalUploading && !uploadJustCompletedRef.current) {
      setFormData(prev => {
        // Update if attachment count changed (additions or removals from cache)
        if (action.attachments?.length !== prev.attachments?.length) {
          return {
            ...action,
            plan_commitment: action.plan_commitment || false,
            policy_agreed_at: action.policy_agreed_at || null,
            policy_agreed_by: action.policy_agreed_by || null,
            required_stock: action.required_stock || [],
            required_tools: action.required_tools || [],
            attachments: action.attachments || []
          };
        }
        return prev;
      });
    }
  }, [action?.attachments?.length, action?.implementation_update_count, isCreating, isFormInitialized, isUploading, isLocalUploading]);

  // Fetch mission data when action has mission_id - use TanStack Query cache
  const { data: missions = [] } = useQuery({
    queryKey: missionsQueryKey(),
    queryFn: async () => {
      const result = await apiService.get('/missions');
      return result.data || [];
    },
    enabled: !!formData.mission_id && open, // Only fetch when dialog is open and we have a mission_id
    ...offlineQueryConfig,
  });

  // Find mission from cached data
  useEffect(() => {
    if (formData.mission_id && missions.length > 0) {
      const mission = missions.find((m: any) => m.id === formData.mission_id);
      setMissionData(mission || null);
    } else {
      setMissionData(null);
    }
  }, [formData.mission_id, missions]);

  // Sync implementation update count when action changes
  useEffect(() => {
    if (action?.id) {
      setImplementationUpdateCount(action.implementation_update_count || 0);
    } else {
      setImplementationUpdateCount(0);
    }
  }, [action?.id, action?.implementation_update_count]);

  const getDialogTitle = () => {
    if (!isCreating && action) {
      return action.title || 'Untitled Action';
    }
    
    if (context?.type === 'issue') {
      return 'Create Action from Issue';
    }
    if (context?.type === 'mission') {
      return 'Create Project Action';
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
      const result = await apiService.get(`/action_implementation_updates?action_id=${action.id}&limit=1`);
      const updates = result.data || [];
      
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
      const result = await apiService.get(`/action_implementation_updates?action_id=${action.id}&limit=1`);
      const updates = result.data || [];
      
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
      // Ensure we have user ID before processing stock
      if (!user?.id) {
        toast({
          title: "Error",
          description: "User authentication is missing. Please refresh the page.",
          variant: "destructive"
        });
        setIsCompleting(false);
        return;
      }

      // Process required stock consumption if any
      const requiredStock = formData.required_stock || [];
      if (requiredStock.length > 0) {
        await processStockConsumption(requiredStock, action.id);
      }

      // Update action to completed status
      await apiService.post('/actions', {
        id: action.id,
        title: formData.title,
        description: formData.description,
        policy: formData.policy,
        assigned_to: formData.assigned_to,
        estimated_duration: formData.estimated_duration,
        required_stock: formData.required_stock,
        attachments: formData.attachments,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Auto-checkin tools
      try {
        await autoCheckinToolsForAction({
          actionId: action.id,
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

  const handleCopyLink = async () => {
    if (!action?.id) {
      toast({
        title: "Cannot copy link",
        description: "Please save the action first before copying its link",
        variant: "destructive",
      });
      return;
    }
    
    const actionUrl = generateActionUrl(action.id);
    const success = await copyToClipboard(actionUrl);
    
    if (success) {
      setLinkCopied(true);
      toast({
        title: "Link copied!",
        description: "Action link has been copied to your clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } else {
      toast({
        title: "Failed to copy",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const processStockConsumption = async (requiredStock: any[], actionId: string) => {
    if (!requiredStock || requiredStock.length === 0) {
      return; // No stock to process
    }
    
    if (!user?.id) {
      console.error('User ID required for stock consumption', { 
        userId: user?.id
      });
      toast({
        title: "Error",
        description: "Unable to process stock consumption: user information missing",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use the utility function from utils.ts
      // Organization ID is handled by the backend authorizer, not needed here
      const { processStockConsumption: processStock } = await import('@/lib/utils');
      await processStock(
        requiredStock,
        actionId,
        user.id,
        formData.title || action?.title || 'Unknown Action',
        action?.mission_id
      );
    } catch (error) {
      console.error('Error processing stock consumption:', error);
      toast({
        title: "Error",
        description: "Failed to process stock consumption. Please try again.",
        variant: "destructive"
      });
      throw error; // Re-throw so calling function can handle it
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    event.target.value = '';
    setIsLocalUploading(true);

    try {
      const uploadResults = await uploadImages(fileArray, { bucket: 'mission-attachments' as const });
      const resultsArray = Array.isArray(uploadResults) ? uploadResults : [uploadResults];
      const uploadedUrls = resultsArray.map(result => result.url);
      
      if (uploadedUrls.length === 0) {
        throw new Error('No files were uploaded successfully');
      }
      
      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedUrls]
      }));
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} file(s) uploaded successfully`
      });
      
      uploadJustCompletedRef.current = true;
      setTimeout(() => {
        uploadJustCompletedRef.current = false;
      }, 500);
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive"
      });
    } finally {
      setIsLocalUploading(false);
    }
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
      await apiService.delete(`/actions/${action.id}`);

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

    setIsSubmitting(true);
    
    try {
      const estimatedDuration = estimatedDate ? estimatedDate.toISOString() : null;

      // Normalize rich text content
      const normalizedPolicy = sanitizeRichText(formData.policy);
      
      const actionStatus = formData.status || 'not_started';

      // Get current user ID
      const userId = user?.id || '00000000-0000-0000-0000-000000000000';

      const actionData: any = {
        title: formData.title.trim(),
        description: formData.description || null,
        policy: normalizedPolicy,
        assigned_to: formData.assigned_to === 'unassigned' ? null : formData.assigned_to || null,
        participants: formData.participants || [],
        estimated_duration: estimatedDuration,
        required_stock: formData.required_stock || [],
        required_tools: formData.required_tools || [],
        // Always include attachments array, even if empty, so removals are properly saved
        attachments: Array.isArray(formData.attachments) ? formData.attachments : [],
        mission_id: formData.mission_id || null,
        asset_id: formData.asset_id || null,
        linked_issue_id: formData.linked_issue_id || null,
        issue_reference: formData.issue_reference || null,
        status: actionStatus,
        plan_commitment: formData.plan_commitment || false,
        policy_agreed_at: formData.policy_agreed_at || null,
        policy_agreed_by: formData.policy_agreed_by || null,
        created_by: isCreating || !action?.id ? userId : action.created_by || userId,
        updated_by: userId
      };
      
      // Debug logging for attachment updates
      if (action?.id && action.attachments?.length !== actionData.attachments.length) {
        console.log('Attachments changed:', {
          actionId: action.id,
          oldCount: action.attachments?.length || 0,
          newCount: actionData.attachments.length,
          oldAttachments: action.attachments,
          newAttachments: actionData.attachments
        });
      }



      await saveActionMutation.mutateAsync(isCreating || !action?.id ? actionData : { ...actionData, id: action.id });
    } catch (error) {
      // Error handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get border styling based on current form data
  // Use local implementationUpdateCount state so border updates immediately when updates are added
  const borderStyle = getActionBorderStyle({
    status: action?.status || formData.status || 'not_started',
    policy: formData.policy,
    assigned_to: formData.assigned_to,
    plan_commitment: formData.plan_commitment,
    implementation_update_count: implementationUpdateCount
  });


  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        /**
         * CRITICAL: Prevent dialog from closing during file upload
         * 
         * This prevents a regression where closing the dialog during upload
         * caused unwanted navigation to /actions page on mobile devices.
         * 
         * Problem: On mobile, when the dialog closed during upload, the
         * onOpenChange handler in Actions.tsx would navigate to /actions,
         * causing the page to reload and losing the upload progress.
         * 
         * Solution: Block dialog close when isUploading is true, showing
         * a toast message instead. This ensures uploads complete before
         * the dialog can be closed.
         * 
         * DO NOT REMOVE THIS CHECK without:
         * 1. Understanding the mobile upload flow
         * 2. Testing on real mobile devices
         * 3. Ensuring navigation doesn't occur during upload
         * 4. Updating the test in UnifiedActionDialog.upload.test.tsx
         * 
         * See: src/components/__tests__/UnifiedActionDialog.upload.test.tsx
         */
        if (!newOpen && (isUploading || isLocalUploading || uploadJustCompletedRef.current)) {
          if (isUploading || isLocalUploading) {
            toast({
              title: "Upload in progress",
              description: "Please wait for the upload to complete before closing.",
              variant: "default",
              duration: 3000
            });
          }
          return;
        }
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className={cn(
        "max-w-lg sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6",
        borderStyle.borderColor
      )}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <div className="flex items-center gap-2">
              {!isCreating && action?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className={`h-7 w-7 p-0 ${linkCopied ? 'border-green-500 border-2' : ''}`}
                  title="Copy action link"
                >
                  {linkCopied ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMissionDialog(true)}
                className={`h-7 w-7 p-0 ${formData.mission_id ? 'bg-primary/10 border-primary/50' : ''}`}
                title={formData.mission_id ? "Change linked project" : "Link to project"}
              >
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
                <Flag className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">Project Context</h4>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Project #{missionData.mission_number}: {missionData.title}
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

          {/* Title */}
          <div>
            <Label htmlFor="actionTitle" className="text-sm font-medium break-words">
              Title *
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
          {/* Assigned To and Participants Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo" className="text-sm font-medium break-words">
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

            <div className="space-y-2">
              <Label htmlFor="participants" className="text-sm font-medium break-words">
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
          </div>

          {/* Estimated Completion Date - Full Width Row */}
          <div className="space-y-2">
            <Label htmlFor="estimated_completion_date" className="flex items-start gap-1 break-words">
              <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Estimated Completion Date</span>
            </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1 !whitespace-normal min-w-0",
                      !estimatedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="break-words">
                      {estimatedDate ? (
                        format(estimatedDate, "PPP")
                      ) : (
                        "Pick a completion date"
                      )}
                    </span>
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
            <div className="pt-2 border-t border-border">
                <div className="flex items-start space-x-3">
                  <Switch
                    id="plan-commitment"
                    checked={formData.plan_commitment || false}
                    onCheckedChange={async (checked) => {
                      setFormData({
                        ...formData, 
                        plan_commitment: checked,
                        policy_agreed_at: checked ? new Date().toISOString() : null,
                        policy_agreed_by: checked ? user?.id : null,
                        status: checked ? 'in_progress' : 'not_started'
                      });
                      
                      // Create checkouts from required_tools when plan is committed
                      if (action?.id && checked && formData.required_tools && Array.isArray(formData.required_tools) && formData.required_tools.length > 0) {
                        try {
                          // Get current user info
                          const userId = user?.id || '00000000-0000-0000-0000-000000000000';
                          const userFullName = resolveUserFullName();

                          // Create active checkouts for all tools in required_tools
                          for (const toolId of formData.required_tools) {
                            if (!toolId) {
                              console.warn('Skipping checkout creation: toolId is missing');
                              continue;
                            }
                            
                            try {
                              await apiService.post('/checkouts', {
                                tool_id: toolId,
                                user_id: userId,
                                user_name: userFullName,
                                action_id: action.id,
                                is_returned: false,
                                checkout_date: new Date().toISOString()
                              });
                              // Update tool status to checked_out
                              await apiService.put(`/tools/${toolId}`, { status: 'checked_out' });
                            } catch (error: any) {
                              // Ignore if tool already has active checkout
                              const errorMessage = typeof error.message === 'string' ? error.message : String(error.message || '');
                              const errorData = error.error || {};
                              const errorDataStr = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
                              
                              // Check for various error conditions
                              const isActiveCheckoutError = 
                                errorMessage.includes('active checkout') ||
                                errorMessage.includes('idx_unique_active_checkout_per_tool') ||
                                errorMessage.includes('duplicate key') ||
                                errorDataStr.includes('active checkout') ||
                                errorDataStr.includes('idx_unique_active_checkout_per_tool') ||
                                errorDataStr.includes('duplicate key') ||
                                error?.status === 409;
                              
                              if (!isActiveCheckoutError) {
                                console.error(`Error creating checkout for tool ${toolId}:`, {
                                  error,
                                  errorMessage,
                                  errorData,
                                  toolId,
                                  userId,
                                  userFullName,
                                  actionId: action.id
                                });
                                // Show toast for unexpected errors
                                toast({
                                  title: "Error",
                                  description: `Failed to create checkout for tool. ${errorMessage}`,
                                  variant: "destructive"
                                });
                              }
                            }
                          }
                        } catch (error) {
                          console.error('Error creating checkouts from required_tools:', error);
                        }
                      }
                      
                      // Also activate any existing planned checkouts
                      if (action?.id && checked) {
                        try {
                          await activatePlannedCheckoutsIfNeeded(action.id, organizationId);
                        } catch (error) {
                          console.error('Error activating checkouts:', error);
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

          {/* Assets and Stock Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-4">
            {/* Assets */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 break-words">
                <Wrench className="w-4 h-4 flex-shrink-0" />
                Assets
              </Label>
              <AssetSelector
                formData={formData}
                setFormData={setFormData}
                onAssetClick={(assetId) => setSelectedAssetId(assetId)}
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1 break-words">
                <Package className="w-4 h-4 flex-shrink-0" />
                Stock
              </Label>
              <StockSelector
                selectedStock={formData.required_stock || []}
                onStockChange={(stock) => setFormData(prev => ({ 
                  ...prev, 
                  required_stock: stock 
                }))}
                onStockClick={(partId) => setSelectedStockId(partId)}
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
                <Label className="text-foreground">Action Policy</Label>
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
                  onUpdate={async () => {
                    // Update local implementation update count immediately for border color
                    try {
                      const result = await apiService.get(`/action_implementation_updates?action_id=${action.id}`);
                      const updates = result.data || [];
                      setImplementationUpdateCount(updates.length);
                    } catch (error) {
                      console.error('Error fetching update count:', error);
                    }
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
            <Label className="text-sm font-medium break-words">Attachments (Images & PDFs)</Label>
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="attachmentUpload"
                disabled={isUploading || isLocalUploading}
                key={`file-input-${action?.id || 'new'}`}
              />
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={isUploading || isLocalUploading}
                className="w-full"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {(isUploading || isLocalUploading) ? 'Uploading...' : 'Upload Images & PDFs'}
              </Button>
            </div>
            
            {/* Display uploaded attachments */}
            {(formData.attachments || []).length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-muted-foreground">Uploaded attachments:</p>
                <div className="flex flex-wrap gap-2">
                  {(formData.attachments || []).map((url, index) => {
                    const isPdf = url.toLowerCase().endsWith('.pdf');
                    const fullUrl = url.startsWith('http') ? url : `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${url}`;
                    return (
                      <div key={index} className="relative">
                        {isPdf ? (
                          <div
                            className="h-16 w-16 flex items-center justify-center bg-muted rounded border cursor-pointer hover:bg-muted/80"
                            onClick={() => window.open(fullUrl, '_blank')}
                          >
                            <svg className="h-8 w-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ) : (
                          <img
                            src={fullUrl}
                            alt={`Attachment ${index + 1}`}
                            className="h-16 w-16 object-cover rounded border cursor-pointer"
                            onClick={() => window.open(fullUrl, '_blank')}
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
                {isCompleting ? 'Marking Complete...' : 'Done'}
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading || isLocalUploading}
              className="flex-1"
            >
              {isSubmitting ? (isCreating ? 'Creating...' : 'Saving...') : (isCreating ? 'Create Action' : 'Save Changes')}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Asset Detail Dialog */}
      <Dialog open={!!selectedAssetId} onOpenChange={(open) => !open && setSelectedAssetId(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
          </DialogHeader>
          {selectedAssetId && (() => {
            const tool = queryClient.getQueryData<any[]>(['tools'])?.find(t => t.id === selectedAssetId);
            const allCheckouts = queryClient.getQueryData<any[]>(['checkouts']) || [];
            const toolHistory = allCheckouts.filter((c: any) => c.tool_id === selectedAssetId);
            const currentCheckout = toolHistory.find((c: any) => !c.is_returned);
            
            return (
              <ToolDetails
                tool={tool}
                toolHistory={toolHistory}
                currentCheckout={currentCheckout}
                onBack={() => setSelectedAssetId(null)}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Stock Detail Dialog */}
      <Dialog open={!!selectedStockId} onOpenChange={(open) => !open && setSelectedStockId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Item Details</DialogTitle>
          </DialogHeader>
          {selectedStockId && (
            <StockDetails
              stock={queryClient.getQueryData<any[]>(['parts'])?.find(p => p.id === selectedStockId) as any}
              issues={[]}
              onBack={() => setSelectedStockId(null)}
              onResolveIssue={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Mission Selection Dialog */}
      <Dialog open={showMissionDialog} onOpenChange={setShowMissionDialog}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Link to Project</DialogTitle>
            <DialogDescription>
              Search and select a project to link this action to.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 min-w-0">
            <MissionSelector
              selectedMissionId={formData.mission_id}
              onMissionChange={(missionId) => {
                setFormData(prev => ({ 
                  ...prev, 
                  mission_id: missionId || null,
                  // Clear other parent relationships when linking to mission
                  asset_id: missionId ? null : prev.asset_id,
                  linked_issue_id: missionId ? null : prev.linked_issue_id
                }));
                // Close dialog after selection
                if (missionId) {
                  setShowMissionDialog(false);
                }
              }}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowMissionDialog(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}