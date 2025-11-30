import { useState, useEffect } from "react";
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
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";

import { supabase } from '@/lib/client';
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
  const [actions, setActions] = useState<BaseAction[]>([]);
  const [toolName, setToolName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const { getActionsForIssue, markActionComplete, markActionIncomplete, loading } = useIssueActions();
  
  // Use organization_members for consistent "Assigned to" dropdown
  // This ensures we only show active members from the current organization
  const { members: organizationMembers } = useOrganizationMembers();
  
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

  // Fetch actions and profiles when dialog opens
  useEffect(() => {
    if (open) {
      // Clear actions immediately to prevent flashing
      setActions([]);
      fetchActionsAndProfiles();
    } else {
      // Clear actions when dialog closes to prevent next flash
      setActions([]);
    }
  }, [open, issue.id]);

  const fetchActionsAndProfiles = async () => {
    // Fetch actions for this issue
    const issueActions = await getActionsForIssue(issue.id);
    setActions(issueActions);

    // Fetch tool name if tool_id exists
    try {
      if (issue.tool_id) {
        const toolResponse = await supabase
          .from('tools')
          .select('name')
          .eq('id', issue.tool_id)
          .single();
        
        if (toolResponse.error) {
          console.warn('Could not fetch tool name:', toolResponse.error);
          setToolName("Unknown Tool");
        } else {
          setToolName(toolResponse.data?.name || "Unknown Tool");
        }
      } else {
        setToolName(""); 
      }
    } catch (error) {
      console.error('Error fetching tool name:', error);
    }
  };

  const handleToggleComplete = async (action: BaseAction) => {
    const isCompleted = action.status === 'completed';
    const success = isCompleted 
      ? await markActionIncomplete(action.id)
      : await markActionComplete(action);
    
    if (success) {
      await fetchActionsAndProfiles();
      onRefresh();
    }
  };

  const handleActionCreated = () => {
    fetchActionsAndProfiles();
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
                      onClick={() => setEditingAction(action)}
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
        open={showCreateDialog || !!editingAction}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingAction(null);
          }
        }}
        action={editingAction || undefined}
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
        onActionSaved={() => {
          setShowCreateDialog(false);
          setEditingAction(null);
          handleActionCreated();
        }}
        isCreating={showCreateDialog}
      />

    </>
  );
}