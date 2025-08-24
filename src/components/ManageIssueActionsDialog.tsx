import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Circle, Calendar, User, Plus } from "lucide-react";
import { useIssueActions, IssueAction } from "@/hooks/useIssueActions";
import { CreateActionFromIssueDialog } from "./CreateActionFromIssueDialog";
import { ActionEditDialog } from "./ActionEditDialog";
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
  const [actions, setActions] = useState<IssueAction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toolName, setToolName] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<IssueAction | null>(null);
  const { getActionsForIssue, markActionComplete, markActionIncomplete, loading } = useIssueActions();

  // Fetch actions and profiles when dialog opens
  useEffect(() => {
    if (open) {
      fetchActionsAndProfiles();
    }
  }, [open, issue.id]);

  const fetchActionsAndProfiles = async () => {
    // Fetch actions for this issue
    const issueActions = await getActionsForIssue(issue.id);
    setActions(issueActions);

    // Fetch profiles for display names and tool name
    try {
      const [profilesResponse, toolResponse] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, role')
          .order('full_name'),
        supabase
          .from('tools')
          .select('name')
          .eq('id', issue.tool_id)
          .single()
      ]);
      
      if (profilesResponse.error) throw profilesResponse.error;
      if (toolResponse.error) throw toolResponse.error;
      
      setProfiles(profilesResponse.data || []);
      setToolName(toolResponse.data?.name || "Unknown Tool");
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getAssigneeName = (userId?: string) => {
    if (!userId) return 'Unassigned';
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || 'Unknown User';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'not_started':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleToggleComplete = async (action: IssueAction) => {
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
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Action
                </Button>
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
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Action
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <Card 
                      key={action.id}
                      className={`border-l-4 transition-all duration-200 cursor-pointer ${
                        action.status === 'completed' 
                          ? 'border-l-green-500 bg-green-50 shadow-green-100 shadow-lg hover:shadow-xl' 
                          : 'border-l-blue-500 hover:shadow-md'
                      }`}
                      onClick={() => setEditingAction(action)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-sm">{action.title}</h5>
                              <Badge className={getStatusColor(action.status)}>
                                {action.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            
                            {action.description && (
                              <p className="text-sm text-muted-foreground mb-2">
                                {action.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{getAssigneeName(action.assigned_to)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Created: {new Date(action.created_at).toLocaleDateString()}</span>
                              </div>
                              {action.completed_at && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>Completed: {new Date(action.completed_at).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>

                            {action.attachments && action.attachments.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-1">Attachments:</p>
                                <div className="flex gap-1 flex-wrap">
                                  {action.attachments.map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`Attachment ${index + 1}`}
                                      className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => window.open(url, '_blank')}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleComplete(action)}
                              className={`flex items-center gap-2 ${
                                action.status === 'completed'
                                  ? 'text-green-700 border-green-500 hover:bg-green-50'
                                  : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {action.status === 'completed' ? (
                                <>
                                  <CheckCircle className="h-4 w-4" />
                                  Mark Incomplete
                                </>
                              ) : (
                                <>
                                  <Circle className="h-4 w-4" />
                                  Mark Complete
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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

      {/* Create Action Dialog */}
      <CreateActionFromIssueDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        issue={issue}
        onActionCreated={handleActionCreated}
      />

      {/* Edit Action Dialog */}
      {editingAction && (
        <ActionEditDialog
          open={!!editingAction}
          onOpenChange={(open) => !open && setEditingAction(null)}
          action={{
            ...editingAction,
            mission_id: '',
            assigned_to: editingAction.assigned_to || null,
            required_tools: [],
            required_stock: []
          }}
          profiles={profiles}
          onSave={() => {
            setEditingAction(null);
            fetchActionsAndProfiles();
            onRefresh();
          }}
          onCancel={() => setEditingAction(null)}
        />
      )}
    </>
  );
}