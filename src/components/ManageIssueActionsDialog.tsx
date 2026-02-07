import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Zap } from "lucide-react";
import { useIssueActions } from "@/hooks/useIssueActions";
import { UnifiedActionDialog } from "./UnifiedActionDialog";
import { BaseAction, createIssueAction } from "@/types/actions";
import { ActionListItemCard } from "./ActionListItemCard";
import { useEnabledMembers } from "@/hooks/useOrganizationMembers";
import { issueActionsQueryKey } from '@/lib/queryKeys';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { apiService, getApiData } from '@/lib/apiService';
import { toast } from "@/hooks/use-toast";

interface ToolIssue {
  id: string;
  description: string;
  issue_type: string;
  status: string;
  reported_at: string;
  tool_id: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface ManageIssueActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: ToolIssue;
  onRefresh: () => void;
}

export function ManageIssueActionsDialog({
  open,
  onOpenChange,
  issue,
  onRefresh
}: ManageIssueActionsDialogProps) {
  const queryClient = useQueryClient();
  const [toolName, setToolName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const { markActionComplete, markActionIncomplete } = useIssueActions();
  
  // Use TanStack Query to fetch actions for this issue - shares cache with GenericIssueCard
  const actionsQuery = useQuery({
    queryKey: issueActionsQueryKey(issue.id),
    queryFn: async () => {
      const response = await apiService.get<{ data: any[] }>(`/actions?linked_issue_id=${issue.id}`);
      const data = response.data || [];
      
      return data.map(action => ({
        ...action,
        required_stock: Array.isArray(action.required_stock) ? action.required_stock : []
      })) as unknown as BaseAction[];
    },
    enabled: open && !!issue.id, // Only fetch when dialog is open
    ...offlineQueryConfig,
    staleTime: 0, // Disable stale time for debugging
  });

  const actions = actionsQuery.data || [];
  const loading = actionsQuery.isLoading;
  
  // Use organization_members for consistent "Assigned to" dropdown
  // This ensures we only show enabled members from the current organization
  const { members: organizationMembers } = useEnabledMembers();
  
  // Transform organization members to Profile format for UnifiedActionDialog
  // Filter out members with empty/whitespace names and map to Profile interface
  const profiles = organizationMembers
    .filter(member => member.full_name && member.full_name.trim() !== '')
    .map(member => ({
      id: member.user_id,
      user_id: member.user_id,
      full_name: member.full_name,
      role: member.role
    }));

  // Fetch tool name when dialog opens
  useEffect(() => {
    if (open && issue.tool_id) {
      const fetchToolName = async () => {
        try {
          const toolResponse = await apiService.get(`/tools/${issue.tool_id}`);
          const toolData = (toolResponse as any).data || toolResponse;
          setToolName(toolData?.name || "Unknown Tool");
        } catch (error) {
          console.error('Error fetching tool name:', error);
          setToolName("Unknown Tool");
        }
      };
      fetchToolName();
    } else {
      setToolName("");
    }
  }, [open, issue.tool_id]);

  const handleToggleComplete = async (action: BaseAction) => {
    const isCompleted = action.status === 'completed';
    
    // Optimistic update
    const previousActions = queryClient.getQueryData<BaseAction[]>(issueActionsQueryKey(issue.id));
    queryClient.setQueryData<BaseAction[]>(issueActionsQueryKey(issue.id), (old) => {
      if (!old) return old;
      return old.map(a => 
        a.id === action.id 
          ? { ...a, status: isCompleted ? 'in_progress' : 'completed', completed_at: isCompleted ? null : new Date().toISOString() }
          : a
      );
    });
    
    // Also update main actions cache
    queryClient.setQueryData<BaseAction[]>(['actions'], (old) => {
      if (!old) return old;
      return old.map(a => 
        a.id === action.id 
          ? { ...a, status: isCompleted ? 'in_progress' : 'completed', completed_at: isCompleted ? null : new Date().toISOString() }
          : a
      );
    });
    
    const success = isCompleted 
      ? await markActionIncomplete(action.id)
      : await markActionComplete(action);
    
    if (success) {
      // Invalidate only related computed data (checkouts, tools)
      queryClient.invalidateQueries({ queryKey: ['checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      onRefresh();
    } else {
      // Rollback on error
      if (previousActions) {
        queryClient.setQueryData(issueActionsQueryKey(issue.id), previousActions);
      }
    }
  };

  const handleActionCreated = (newAction: BaseAction) => {
    // Update issue-specific cache with new action (no invalidation needed)
    queryClient.setQueryData<BaseAction[]>(issueActionsQueryKey(issue.id), (old) => {
      if (!old) return [newAction];
      // Check if action already exists (from optimistic update)
      const existingIndex = old.findIndex(a => a.id === newAction.id);
      if (existingIndex >= 0) {
        const updated = [...old];
        updated[existingIndex] = newAction;
        return updated;
      }
      return [...old, newAction];
    });
    
    // Main actions cache is already updated by UnifiedActionDialog's optimistic update
    // Just invalidate related computed data
    queryClient.invalidateQueries({ queryKey: ['checkouts'] });
    queryClient.invalidateQueries({ queryKey: ['tools'] });
    
    onRefresh();
    toast({
      title: "Success",
      description: "Action created successfully"
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Actions for {toolName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Issue Reference Display */}
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Issue Details</h4>
              <p className="text-sm text-muted-foreground">
                Issue #{issue.id.slice(0, 8)} - {issue.issue_type} - {issue.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-3 w-3" />
                <span className="text-xs text-muted-foreground">
                  Reported: {new Date(issue.reported_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Actions ({actions.length})</h4>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Add Action
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="text-muted-foreground">Loading actions...</div>
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No actions created for this issue yet.</p>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    variant="outline"
                    className="mt-2"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Create First Action
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <ActionListItemCard
                      key={action.id}
                      action={action}
                      profiles={profiles}
                      onClick={() => setEditingActionId(action.id)}
                      showScoreButton={false}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Action Dialog */}
      <UnifiedActionDialog
        open={showCreateDialog || !!editingActionId}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingActionId(null);
          }
        }}
        actionId={editingActionId || undefined}
        context={{
          type: 'issue',
          parentId: issue.id,
          parentTitle: issue.description,
          prefilledData: showCreateDialog ? createIssueAction(
            issue.id, 
            issue.description,
            // Support both legacy tool_id and new context_id format
            (issue as any).tool_id || ((issue as any).context_type === 'tool' ? (issue as any).context_id : undefined)
          ) : undefined
        }}
        profiles={profiles}
        onActionSaved={(savedAction) => {
          setShowCreateDialog(false);
          setEditingActionId(null);
          if (savedAction) {
            handleActionCreated(savedAction);
          }
        }}
        isCreating={showCreateDialog}
      />

    </>
  );
}