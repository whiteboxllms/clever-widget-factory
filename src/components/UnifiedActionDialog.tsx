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
import { apiService, getApiData } from '@/lib/apiService';
import { missionsQueryKey, actionImplementationUpdatesQueryKey, explorationByActionIdQueryKey } from '@/lib/queryKeys';
import { ImplementationUpdate } from '@/types/actions';
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
  Copy,
  Sparkles,
  Search
} from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAuth } from "@/hooks/useCognitoAuth";
import TiptapEditor from './TiptapEditor';
import { ActionImplementationUpdates } from './ActionImplementationUpdates';
import { AssetSelector } from './AssetSelector';
import { StockSelector } from './StockSelector';
import { MultiParticipantSelector } from './MultiParticipantSelector';
import { MissionSelector } from './MissionSelector';
import { cn, sanitizeRichText, getActionBorderStyle } from "@/lib/utils";
import { BaseAction, Profile, ActionCreationContext } from "@/types/actions";
import { autoCheckinToolsForAction, activatePlannedCheckoutsIfNeeded } from '@/lib/autoToolCheckout';
import { generateActionUrl, copyToClipboard } from "@/lib/urlUtils";
import { explorationService } from "@/services/explorationService";
import { aiContentService } from "@/services/aiContentService";
import { ExplorationTab } from "./ExplorationTab";
import { ExplorationAssociationDialog } from "./ExplorationAssociationDialog";

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
  const queryClient = useQueryClient();
  
  // Look up action from cache using ID
  const cachedActions = queryClient.getQueryData(['actions']) as BaseAction[] | undefined;
  const action = actionId && cachedActions ? cachedActions.find(a => a.id === actionId) : undefined;
  const { toast } = useToast();
  const { isLeadership, user } = useAuth();
  const organizationId = useOrganizationId();
  
  const saveActionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      // Use PUT for updates (when id exists), POST for creates
      if (actionData.id) {
        // For PUT requests, exclude id from body since it's in the URL path
        const { id, ...updateData } = actionData;
        const result = await apiService.put(`/actions/${id}`, updateData);
        return result;
      } else {
        const result = await apiService.post('/actions', actionData);
        return result;
      }
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['actions'] });
      
      // Snapshot previous state for rollback
      const previousActions = queryClient.getQueryData<BaseAction[]>(['actions']);
      
      // Optimistic update for immediate UI feedback (offline-first)
      if (variables.id) {
        // Update existing action
        queryClient.setQueryData<BaseAction[]>(['actions'], (old) => {
          if (!old) return old;
          return old.map(action => 
            action.id === variables.id 
              ? { ...action, ...variables, updated_at: new Date().toISOString() }
              : action
          );
        });
      }
      // Don't add optimistic action for creates - wait for server response to avoid duplicates
      
      return { previousActions };
    },
    onSuccess: (data, variables) => {
      // Update cache with server response (no invalidation needed)
      const updatedAction = getApiData<BaseAction>(data);
      let previousAction: BaseAction | undefined;
      
      if (updatedAction) {
        queryClient.setQueryData<BaseAction[]>(['actions'], (old) => {
          if (!old) return old;
          const actionId = updatedAction.id || (variables as BaseAction).id;
          const existingIndex = old.findIndex(a => a.id === actionId);
          
          if (existingIndex >= 0) {
            // Store previous action for invalidation check
            previousAction = old[existingIndex];
            
            // Update existing action - prioritize server response values, fallback to what we sent
            const finalRequiredTools = updatedAction.required_tools !== undefined 
              ? updatedAction.required_tools 
              : (variables.required_tools !== undefined ? variables.required_tools : old[existingIndex].required_tools);
            
            const updated = [...old];
            updated[existingIndex] = { 
              ...old[existingIndex], 
              ...updatedAction,
              // Ensure required_tools and required_stock are explicitly set from server response or variables
              required_tools: finalRequiredTools,
              required_stock: updatedAction.required_stock !== undefined 
                ? updatedAction.required_stock 
                : (variables.required_stock !== undefined ? variables.required_stock : old[existingIndex].required_stock),
              attachments: updatedAction.attachments !== undefined 
                ? updatedAction.attachments 
                : (variables.attachments !== undefined ? variables.attachments : old[existingIndex].attachments)
            };
            return updated;
          } else {
            // Add new action
            return [...old, updatedAction];
          }
        });
      }
      
      // Invalidate related resources that might need background refresh (server-computed data)
      // Only invalidate if the action actually uses tools (required_tools changed)
      // This prevents unnecessary refetches when saving actions without tools
      const hasTools = variables.required_tools && Array.isArray(variables.required_tools) && variables.required_tools.length > 0;
      const hadTools = previousAction?.required_tools && Array.isArray(previousAction.required_tools) && previousAction.required_tools.length > 0;
      const toolsChanged = hasTools || hadTools; // Invalidate if action has or had tools
      
      if (toolsChanged) {
        // Invalidate checkouts and tools in background (non-blocking)
        // These will refetch when components need them, not immediately
        queryClient.invalidateQueries({ queryKey: ['checkouts'] });
        queryClient.invalidateQueries({ queryKey: ['tools'] });
      }
      
      // Also invalidate issue-specific actions cache if this action is linked to an issue
      if (variables.linked_issue_id) {
        queryClient.invalidateQueries({ queryKey: ['issue_actions', variables.linked_issue_id] });
      }
      
      // Show appropriate toast message based on action status
      const isCompleting = variables.status === 'completed' || updatedAction?.status === 'completed';
      toast({
        title: isCompleting ? "Action Completed!" : "Success",
        description: isCompleting 
          ? "The action has been marked as complete and stock consumption recorded."
          : (isCreating || !action?.id ? "Action created successfully" : "Action updated successfully")
      });
      // Don't close dialog if uploads are in progress OR if this is an auto-save from upload
      console.log('[DIALOG] onSuccess - isUploading:', isUploading, 'isLocalUploading:', isLocalUploading, 'isAutoSavingFromUpload:', isAutoSavingFromUploadRef.current);
      if (!isUploading && !isLocalUploading && !isAutoSavingFromUploadRef.current) {
        console.log('[DIALOG] Closing dialog');
        onActionSaved(updatedAction as BaseAction);
        onOpenChange(false);
      } else {
        console.log('[DIALOG] Keeping dialog open - skipping callbacks');
      }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousActions) {
        queryClient.setQueryData(['actions'], context.previousActions);
      }
      
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLocalUploading, setIsLocalUploading] = useState(false);
  const uploadCompletedTimeRef = useRef<number>(0);
  const isAutoSavingFromUploadRef = useRef<boolean>(false);
  
  // Exploration-related state
  const [isExploration, setIsExploration] = useState(false);
  const [explorationCode, setExplorationCode] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [hasExplorationData, setHasExplorationData] = useState(false);
  const [checkingExploration, setCheckingExploration] = useState(false);
  const [showExplorationDialog, setShowExplorationDialog] = useState(false);
  const [linkedExplorationIds, setLinkedExplorationIds] = useState<string[]>([]);
  const [linkedExplorations, setLinkedExplorations] = useState<Array<{ id: string; exploration_code: string; name?: string }>>([]);
  const [codeValidationState, setCodeValidationState] = useState<{
    isValid: boolean;
    isUnique: boolean;
    isChecking: boolean;
    message: string;
  }>({
    isValid: true,
    isUnique: true,
    isChecking: false,
    message: ''
  });

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
    // Use profiles prop instead of fetching organizationMembers again
    const member = profiles.find(
      (m: any) => m.cognito_user_id === user.id || m.user_id === user.id
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
      
      // Don't invalidate cache - use cached data instead (prevents 639KB refetch)
      // The cache is already up-to-date from mutations and initial load
      // Only fetch if action is truly not in cache (handled by Actions.tsx)
      
      // Only reset form if it's a different action/context or first time opening
      if (!isSameSession || !isFormInitialized) {
        if (action && !isCreating) {
          // Editing existing action - update formData when action changes from cache
          setFormData(prev => {
            // Only update if this is a new session or attachments/required_tools/required_stock changed
            const attachmentsChanged = action.attachments?.length !== prev.attachments?.length;
            const requiredToolsChanged = JSON.stringify([...(action.required_tools || [])].sort()) !== JSON.stringify([...(prev.required_tools || [])].sort());
            const requiredStockChanged = JSON.stringify([...(action.required_stock || [])].sort()) !== JSON.stringify([...(prev.required_stock || [])].sort());
            
            if (!isSameSession || attachmentsChanged || requiredToolsChanged || requiredStockChanged) {
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
          
          // Initialize exploration state from action
          const hasExploration = !!(action as any).is_exploration;
          console.log('Action has exploration flag:', hasExploration, 'Action ID:', action.id);
          setIsExploration(hasExploration);
          // Exploration code will be loaded via React Query hook above
          setExplorationCode('');
          
          // Initialize implementation update count from action
          setImplementationUpdateCount(action.implementation_update_count || 0);
          if (action.estimated_duration) {
            const parsedDate = new Date(action.estimated_duration);
            // Only set if date is valid
            if (!isNaN(parsedDate.getTime())) {
              setEstimatedDate(parsedDate);
            } else {
              setEstimatedDate(undefined);
            }
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
          
          // Initialize exploration state for new actions
          setIsExploration(false);
          setExplorationCode('');
          
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
  }, [open, actionId, context?.type, isCreating, action]);

  // Update formData when action changes from cache (after refetch)
  useEffect(() => {
    // Don't sync from cache within 2 seconds of upload completing
    const timeSinceUpload = Date.now() - uploadCompletedTimeRef.current;
    if (action && !isCreating && isFormInitialized && !isUploading && !isLocalUploading && timeSinceUpload > 2000) {
      setFormData(prev => {
        // Update if attachment count, required_tools, or required_stock changed (additions or removals from cache)
        const attachmentsChanged = action.attachments?.length !== prev.attachments?.length;
        const requiredToolsChanged = JSON.stringify([...(action.required_tools || [])].sort()) !== JSON.stringify([...(prev.required_tools || [])].sort());
        const requiredStockChanged = JSON.stringify([...(action.required_stock || [])].sort()) !== JSON.stringify([...(prev.required_stock || [])].sort());
        
        if (attachmentsChanged || requiredToolsChanged || requiredStockChanged) {
          console.log('[DIALOG] useEffect syncing from cache - OVERWRITING formData!', {
            actionAttachments: action.attachments?.length,
            prevAttachments: prev.attachments?.length,
            timeSinceUpload
          });
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
  }, [action?.attachments?.length, action?.required_tools, action?.required_stock, action?.implementation_update_count, isCreating, isFormInitialized, isUploading, isLocalUploading]);

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

  // Fetch exploration data if this is an exploration action
  const explorationQueryEnabled = !!(action?.id && action?.is_exploration && open);
  
  const { data: explorationData } = useQuery({
    queryKey: explorationByActionIdQueryKey(action?.id || ''),
    queryFn: async () => {
      if (!action?.id) return null;
      return await explorationService.getExplorationByActionId(action.id);
    },
    enabled: explorationQueryEnabled,
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

  // Sync exploration code from query data
  useEffect(() => {
    console.log('Exploration data changed:', explorationData);
    if (explorationData?.exploration_code) {
      console.log('Setting exploration code from query:', explorationData.exploration_code);
      setExplorationCode(explorationData.exploration_code);
    } else if (explorationData && !explorationData.exploration_code) {
      console.log('Exploration data exists but no code:', explorationData);
    }
  }, [explorationData]);

  // Load linked explorations when action loads
  useEffect(() => {
    const loadLinkedExplorations = async () => {
      if (!action?.id || !open) return;
      
      try {
        const result = await apiService.get(`/explorations?action_id=${action.id}`);
        const explorations = result.data || [];
        const explorationIds = explorations.map((e: any) => e.id);
        setLinkedExplorationIds(explorationIds);
        setLinkedExplorations(explorations.map((e: any) => ({ 
          id: e.id, 
          exploration_code: e.exploration_code,
          name: e.name 
        })));
        
        // Also set is_exploration flag if there are linked explorations
        if (explorationIds.length > 0) {
          setIsExploration(true);
        }
      } catch (error) {
        console.error('Error loading linked explorations:', error);
      }
    };
    
    loadLinkedExplorations();
  }, [action?.id, open]);

  // Load exploration code when dialog opens with an exploration action
  useEffect(() => {
    if (open && action?.id && (action as any).is_exploration && !explorationCode) {
      console.log('Loading exploration code for action:', action.id);
      (async () => {
        try {
          const exploration = await explorationService.getExplorationByActionId(action.id);
          if (exploration?.exploration_code) {
            console.log('Loaded exploration code:', exploration.exploration_code);
            setExplorationCode(exploration.exploration_code);
          }
        } catch (error) {
          console.error('Error loading exploration code:', error);
        }
      })();
    }
  }, [open, action?.id]);

  // Sync implementation update count when action changes
  useEffect(() => {
    if (action?.id) {
      setImplementationUpdateCount(action.implementation_update_count || 0);
    } else {
      setImplementationUpdateCount(0);
    }
  }, [action?.id, action?.implementation_update_count]);

  // Check if action has exploration data
  useEffect(() => {
    const checkExplorationData = async () => {
      if (!action?.id || isCreating) {
        setHasExplorationData(false);
        return;
      }

      try {
        setCheckingExploration(true);
        const exploration = await explorationService.getExplorationByActionId(action.id);
        setHasExplorationData(!!exploration);
      } catch (error) {
        console.error('Error checking exploration data:', error);
        setHasExplorationData(false);
      } finally {
        setCheckingExploration(false);
      }
    };

    checkExplorationData();
  }, [action?.id, isCreating]);

  const getDialogTitle = () => {
    // If we have an actionId, we're editing (even if action not in cache yet)
    if (!isCreating && (action || actionId)) {
      return action?.title || 'Edit Action';
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

      // Update action to completed status using saveActionMutation to ensure cache is updated
      const actionData = {
        id: action.id,
        title: formData.title,
        description: formData.description,
        policy: formData.policy,
        assigned_to: formData.assigned_to,
        estimated_duration: formData.estimated_duration,
        required_stock: formData.required_stock,
        required_tools: formData.required_tools,
        attachments: formData.attachments,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Use the mutation to ensure cache is properly updated
      await saveActionMutation.mutateAsync(actionData);

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

      // The mutation's onSuccess handler will update the cache with the completed status,
      // show toast, call onActionSaved, and close the dialog
      // No need to do anything else here - the mutation handles everything
    } catch (error: any) {
      console.error('Error completing action:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to complete action and record stock usage";
      if (error?.message) {
        if (error.message.includes('no longer exists in inventory')) {
          // This is the specific error for missing parts - show the full message
          errorMessage = error.message;
        } else if (error.message.includes('Part with ID') && error.message.includes('not found')) {
          errorMessage = `Stock item not found. Please check that all required stock items still exist.`;
        } else if (error.message.includes('stock consumption')) {
          errorMessage = `Failed to process stock consumption: ${error.message}`;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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

  // Handle exploration checkbox change
  const handleExplorationToggle = (checked: boolean) => {
    setIsExploration(checked);
    
    if (checked) {
      // Open the exploration association dialog
      setShowExplorationDialog(true);
    } else {
      // Clear exploration association when unchecked
      setLinkedExplorationIds([]);
      setLinkedExplorations([]);
      setExplorationCode('');
    }
  };

  // Handle exploration linked from dialog
  const handleExplorationLinked = async (exploration: { id: string; exploration_code: string; name?: string }) => {
    setLinkedExplorationIds([exploration.id]);
    setLinkedExplorations([{ id: exploration.id, exploration_code: exploration.exploration_code, name: exploration.name }]);
    setShowExplorationDialog(false);
    toast({
      title: "Success",
      description: "Exploration linked successfully"
    });
  };

  // Generate exploration code
  const generateExplorationCode = async () => {
    setIsGeneratingCode(true);
    try {
      const code = await explorationService.generateExplorationCode(new Date());
      setExplorationCode(code);
      // Validate the generated code
      await validateExplorationCode(code);
    } catch (error) {
      console.error('Error generating exploration code:', error);
      toast({
        title: "Error",
        description: "Failed to generate exploration code",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Validate exploration code format and uniqueness
  const validateExplorationCode = async (code: string) => {
    if (!code) {
      setCodeValidationState({
        isValid: true,
        isUnique: true,
        isChecking: false,
        message: ''
      });
      return;
    }

    // Check format first (synchronously)
    const formatRegex = /^[A-Z]{2}\d{6}[A-Z]{2}\d{2,}$/;
    const isValidFormat = formatRegex.test(code);

    if (!isValidFormat) {
      setCodeValidationState({
        isValid: false,
        isUnique: true,
        isChecking: false,
        message: 'Invalid format. Expected: SF<mmddyy><SUFFIX><number> (e.g., SF010126EX01 or SF122925CT01)'
      });
      return;
    }

    // Format is valid - now check uniqueness via backend (show yellow while checking)
    setCodeValidationState({
      isValid: true,
      isUnique: true,
      isChecking: true,
      message: 'Validating...'
    });

    try {
      const codeExists = await explorationService.codeExists(code);
      
      if (!codeExists) {
        // Code doesn't exist anywhere - it's available
        setCodeValidationState({
          isValid: true,
          isUnique: true,
          isChecking: false,
          message: 'Code is valid and unique'
        });
        return;
      }
      
      // Code exists - check if it belongs to current action
      if (action?.id) {
        const existingExploration = await explorationService.getExplorationByActionId(action.id);
        
        if (existingExploration?.exploration_code === code) {
          // Code belongs to this action - it's valid
          setCodeValidationState({
            isValid: true,
            isUnique: true,
            isChecking: false,
            message: 'Code is valid (current code for this action)'
          });
        } else {
          // Code exists but belongs to a different action
          setCodeValidationState({
            isValid: true,
            isUnique: false,
            isChecking: false,
            message: '⚠️ Code is already in use - please choose a different code'
          });
        }
      } else {
        // No action context but code exists
        setCodeValidationState({
          isValid: true,
          isUnique: false,
          isChecking: false,
          message: '⚠️ Code is already in use - please choose a different code'
        });
      }
    } catch (error) {
      console.error('Error validating exploration code:', error);
      // If validation fails, allow the code but warn the user
      setCodeValidationState({
        isValid: true,
        isUnique: true,
        isChecking: false,
        message: 'Unable to validate uniqueness'
      });
    }
  };

  // Auto-save exploration code when it's valid and unique
  useEffect(() => {
    const autoSaveExplorationCode = async () => {
      if (
        action?.id &&
        isExploration &&
        explorationCode &&
        codeValidationState.isValid &&
        codeValidationState.isUnique &&
        !codeValidationState.isChecking
      ) {
        try {
          console.log('Auto-saving exploration code:', explorationCode);
          const existingExploration = await explorationService.getExplorationByActionId(action.id);
          
          if (existingExploration && existingExploration.exploration_code !== explorationCode) {
            console.log('Updating exploration code from', existingExploration.exploration_code, 'to', explorationCode);
            await explorationService.updateExplorationByActionId(action.id, {
              exploration_code: explorationCode
            });
            console.log('Exploration code saved successfully');
            
            // Invalidate the exploration query cache so it reloads with the new code
            queryClient.invalidateQueries({ queryKey: explorationByActionIdQueryKey(action.id) });
          }
        } catch (error) {
          console.error('Error auto-saving exploration code:', error);
        }
      }
    };

    autoSaveExplorationCode();
  }, [explorationCode, codeValidationState.isValid, codeValidationState.isUnique, codeValidationState.isChecking, action?.id, isExploration, queryClient]);

  // Handle exploration code input change with debounced validation
  const handleExplorationCodeChange = (value: string) => {
    setExplorationCode(value);
    
    // Debounce validation to avoid too many API calls
    const timeoutId = setTimeout(() => {
      validateExplorationCode(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Generate AI summary policy text
  const generateAISummaryPolicy = async () => {
    if (!formData.description && !formData.policy) {
      toast({
        title: "Missing Information",
        description: "Please add a description or policy text first",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAI(true);
    try {
      const response = await aiContentService.generateSummaryPolicy({
        state_text: formData.description || '',
        policy_text: formData.policy || '',
        action_context: {
          title: formData.title,
          assigned_to: formData.assigned_to || undefined,
          priority: 'normal' // Could be enhanced with actual priority field
        }
      });

      if (response?.content?.summary_policy_text) {
        // Update the Action Policy field with the generated text
        setFormData(prev => ({ 
          ...prev, 
          policy: response.content.summary_policy_text 
        }));
        toast({
          title: "AI Suggestion Generated",
          description: "Action policy has been updated with AI-generated content. You can edit it as needed.",
        });
      } else {
        toast({
          title: "AI Unavailable",
          description: "AI service is currently unavailable. Please enter the policy manually.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast({
        title: "Error",
        description: "Failed to generate AI summary",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAI(false);
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
        action?.mission_id,
        queryClient // Pass queryClient to use cached parts data
      );
    } catch (error: any) {
      console.error('Error processing stock consumption:', error);
      
      // Provide more specific error message
      let errorMessage = "Failed to process stock consumption";
      if (error?.message) {
        if (error.message.includes('no longer exists in inventory')) {
          // This is the specific error for missing parts - show the full message
          errorMessage = error.message;
        } else if (error.message.includes('Part with ID') && error.message.includes('not found')) {
          errorMessage = `Stock item not found: ${error.message}`;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error while processing stock. Please check your connection.";
        } else {
          errorMessage = `Stock processing error: ${error.message}`;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
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
      
      const newAttachments = [...(formData.attachments || []), ...uploadedUrls];
      
      // Update formData immediately
      setFormData(prev => ({
        ...prev,
        attachments: newAttachments
      }));
      
      toast({
        title: "Success",
        description: `${uploadedUrls.length} file(s) uploaded successfully`
      });
      
      // Mark upload completion time to prevent immediate cache sync
      uploadCompletedTimeRef.current = Date.now();
      
      // Auto-save if editing existing action (BEFORE clearing isLocalUploading)
      if (action?.id) {
        try {
          isAutoSavingFromUploadRef.current = true;
          await saveActionMutation.mutateAsync({
            id: action.id,
            attachments: newAttachments
          });
        } catch (saveError) {
          console.error('[DIALOG] Auto-save failed:', saveError);
          // Don't show error - attachments are still in formData and will save on manual save
        } finally {
          isAutoSavingFromUploadRef.current = false;
        }
      }
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

    // Validate exploration fields if exploration is enabled
    if (isExploration) {
      // Check if exploration is linked (via linkedExplorationIds)
      if (!linkedExplorationIds || linkedExplorationIds.length === 0) {
        toast({
          title: "Error",
          description: "Please link an exploration using the 'Link Exploration' button",
          variant: "destructive"
        });
        return;
      }
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
        required_tools: Array.isArray(formData.required_tools) ? formData.required_tools : [],
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
        updated_by: userId,
        // Exploration flag only (code stored in exploration table)
        is_exploration: isExploration
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



      const savedAction = await saveActionMutation.mutateAsync(isCreating || !action?.id ? actionData : { ...actionData, id: action.id });
      
      // Create or update exploration record if this is an exploration action
      if (isExploration && explorationCode && savedAction?.id) {
        console.log('Saving exploration code:', explorationCode, 'for action:', savedAction.id);
        try {
          // Check if exploration already exists
          const existingExploration = await explorationService.getExplorationByActionId(savedAction.id);
          console.log('Existing exploration:', existingExploration);
          if (!existingExploration) {
            console.log('Creating new exploration');
            await explorationService.createExploration({
              action_id: savedAction.id,
              exploration_code: explorationCode,
              public_flag: false
            });
          } else {
            // Update existing exploration with new code
            console.log('Updating existing exploration with code:', explorationCode);
            await explorationService.updateExplorationByActionId(savedAction.id, {
              exploration_code: explorationCode
            });
          }
        } catch (error) {
          console.error('Error creating/updating exploration record:', error);
          // Don't fail the action save if exploration creation fails
        }
      } else {
        console.log('Not saving exploration - isExploration:', isExploration, 'explorationCode:', explorationCode, 'savedAction?.id:', savedAction?.id);
      }
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
        if (!newOpen && (isUploading || isLocalUploading)) {
          toast({
            title: "Upload in progress",
            description: "Please wait for the upload to complete before closing.",
            variant: "default",
            duration: 3000
          });
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

          {/* Exploration Fields */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center space-x-3">
              <Switch
                id="is-exploration"
                checked={isExploration}
                onCheckedChange={handleExplorationToggle}
              />
              <Label htmlFor="is-exploration" className="text-sm font-medium">
                This is an exploration action
              </Label>
            </div>
            
            {isExploration && (
              <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                {/* Linked Explorations Display */}
                {linkedExplorationIds.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Linked Exploration</Label>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-md">
                      <div className="flex-1">
                        {linkedExplorations.map((exp, idx) => (
                          <p key={exp.id} className="text-sm">
                            <span className="font-medium font-mono">{exp.exploration_code}</span>
                            {exp.name && <span className="text-muted-foreground"> - {exp.name}</span>}
                          </p>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExplorationDialog(true)}
                        disabled={!action?.id}
                        title={!action?.id ? "Save action first to change exploration" : ""}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Link Exploration</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowExplorationDialog(true)}
                      disabled={!action?.id}
                      title={!action?.id ? "Save action first to link exploration" : ""}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Link Exploration
                    </Button>
                    {!action?.id && (
                      <p className="text-xs text-muted-foreground">Save the action first to link an exploration</p>
                    )}
                  </div>
                )}
              </div>
            )}
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
                      {estimatedDate && !isNaN(estimatedDate.getTime()) ? (
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
              />
            </div>
          </div>

          {/* Rich Text Content */}
          <Tabs value={activeTab || getDefaultTab()} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full ${hasExplorationData ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="plan">Policy</TabsTrigger>
              <TabsTrigger value="observations">Implementation</TabsTrigger>
              {hasExplorationData && (
                <TabsTrigger value="exploration">Exploration</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="plan" className="mt-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Action Policy</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateAISummaryPolicy}
                    disabled={isGeneratingAI || (!formData.description && !formData.policy)}
                    className="h-7 px-2 text-xs"
                  >
                    {isGeneratingAI ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent mr-1" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    AI Assist
                  </Button>
                </div>
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
                    // Update local implementation update count from cache (no API call needed)
                    const cachedUpdates = queryClient.getQueryData<ImplementationUpdate[]>(actionImplementationUpdatesQueryKey(action.id));
                    if (cachedUpdates) {
                      setImplementationUpdateCount(cachedUpdates.length);
                    }
                  }}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <p>Save the action first to add implementation updates</p>
                </div>
              )}
            </TabsContent>

            {hasExplorationData && (
              <TabsContent value="exploration" className="mt-4">
                {action?.id ? (
                  <ExplorationTab
                    action={action}
                    onUpdate={() => {
                      // Refresh exploration data check after updates
                      if (action?.id) {
                        explorationService.getExplorationByActionId(action.id)
                          .then(exploration => setHasExplorationData(!!exploration))
                          .catch(() => setHasExplorationData(false));
                      }
                    }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p>Save the action first to view exploration data</p>
                  </div>
                )}
              </TabsContent>
            )}
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

      {/* Exploration Association Dialog */}
      {action?.id && (
        <ExplorationAssociationDialog
          actionId={action.id}
          isOpen={showExplorationDialog}
          onClose={() => setShowExplorationDialog(false)}
          onLinked={handleExplorationLinked}
          currentExplorationId={linkedExplorationIds[0]}
        />
      )}
    </Dialog>
  );
}