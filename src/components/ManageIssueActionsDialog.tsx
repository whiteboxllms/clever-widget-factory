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
import { ActionCard } from "./ActionCard";
import { useOrganizationId } from "@/hooks/useOrganizationId";

import { supabase } from "@/integrations/supabase/client";
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toolName, setToolName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const { getActionsForIssue, markActionComplete, markActionIncomplete, loading } = useIssueActions();
  const organizationId = useOrganizationId();

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

    // Fetch profiles for display names and tool name
    try {
      // Always fetch profiles filtered by organization and active status
      const profilesResponse = await supabase
        .from('organization_members')
        .select('id, user_id, full_name, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('full_name');
      
      if (profilesResponse.error) throw profilesResponse.error;
      setProfiles(profilesResponse.data || []);

      // Only fetch tool if tool_id exists
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
      console.error('Error fetching data:', error);
    }
  };

  const handleToggleComplete = async (action: BaseAction) => {
    const isCompleted = action.status === 'completed';
    const success = isCompleted 
      ? await markActionIncomplete(action.id)
      : await markActionComplete(action.id);
    
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
                    <ActionCard
                      key={action.id}
                      action={action}
                      profiles={profiles}
                      onUpdate={fetchActionsAndProfiles}
                      compact={true}
                      onToggleComplete={handleToggleComplete}
                      onEdit={() => setEditingAction(action)}
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
          prefilledData: showCreateDialog ? createIssueAction(issue.id, issue.description) : undefined
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