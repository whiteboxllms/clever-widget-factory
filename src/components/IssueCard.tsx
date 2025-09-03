import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, X, Clock, Edit, Plus, Target, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { UnifiedActionDialog } from "./UnifiedActionDialog";
import { createIssueAction } from "@/types/actions";
import { ManageIssueActionsDialog } from "./ManageIssueActionsDialog";
import { IssueScoreDialog } from "./IssueScoreDialog";
import { IssueQuickResolveDialog } from "./IssueQuickResolveDialog";
import { useAssetScores, AssetScore } from "@/hooks/useAssetScores";
import { useIssueActions } from "@/hooks/useIssueActions";
import { getIssueTypeIcon, getIssueTypeColor } from "@/lib/issueTypeUtils";

interface ToolIssue {
  id: string;
  description: string;
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'preventative_maintenance' | 'functionality' | 'lifespan';
  status: 'active' | 'resolved' | 'removed';
  reported_at: string;
  reported_by: string;
  tool_id: string;
  blocks_checkout?: boolean;
  is_misuse?: boolean;
  damage_assessment?: string;
  responsibility_assigned?: boolean;
  resolution_photo_urls?: string[];
}

interface IssueCardProps {
  issue: ToolIssue;
  onResolve: (issue: ToolIssue) => void;
  onEdit?: (issue: ToolIssue) => void;
  onRefresh: () => void;
}

export function IssueCard({ issue, onResolve, onEdit, onRefresh }: IssueCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showCreateActionDialog, setShowCreateActionDialog] = useState(false);
  const [showManageActionsDialog, setShowManageActionsDialog] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showQuickResolveDialog, setShowQuickResolveDialog] = useState(false);
  const [tool, setTool] = useState<any>(null);
  const [existingScore, setExistingScore] = useState<AssetScore | null>(null);
  const [existingActions, setExistingActions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const { getScoreForIssue } = useAssetScores();
  const { getActionsForIssue } = useIssueActions();

  // Issue type utilities imported from centralized location

  const handleRemove = async () => {
    setIsRemoving(true);
    
    try {
      // Update issue status to removed
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          status: 'removed'
        })
        .eq('id', issue.id);

      if (updateError) throw updateError;

      // Create history record
      const { error: historyError } = await supabase
        .from('issue_history')
        .insert({
          issue_id: issue.id,
          old_status: issue.status,
          new_status: 'removed',
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: 'Issue removed during check-in'
        });

      if (historyError) throw historyError;

      toast({
        title: "Issue removed",
        description: "The issue has been removed from the tool."
      });

      onRefresh();

    } catch (error) {
      console.error('Error removing issue:', error);
      toast({
        title: "Error removing issue",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(false);
    }
  };

  // Fetch profiles data
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, role')
          .order('full_name');
        
        if (error) throw error;
        setProfiles(data || []);
      } catch (error) {
        console.error('Error fetching profiles:', error);
      }
    };

    fetchProfiles();
  }, []);

  // Check for existing score and actions when component mounts
  useEffect(() => {
    const checkExistingData = async () => {
      const [score, actions] = await Promise.all([
        getScoreForIssue(issue.id),
        getActionsForIssue(issue.id)
      ]);
      setExistingScore(score);
      setExistingActions(actions);
    };
    checkExistingData();
  }, [issue.id]);

  const handleAssignScore = async () => {
    try {
      // Use context_id when context_type is 'tool', fallback to tool_id for backward compatibility
      const toolId = (issue as any).context_type === 'tool' ? (issue as any).context_id : issue.tool_id;
      
      if (!toolId) {
        toast({
          title: "Error",
          description: "Tool information not available for this issue",
          variant: "destructive",
        });
        return;
      }

      const { data: toolData, error } = await supabase
        .from('tools')
        .select('*')
        .eq('id', toolId)
        .single();

      if (error) throw error;
      
      setTool(toolData);
      setShowScoreDialog(true);
    } catch (error) {
      console.error('Error fetching tool:', error);
      toast({
        title: "Error",
        description: "Failed to load tool information",
        variant: "destructive",
      });
    }
  };

  const handleManageActions = () => {
    if (existingActions.length > 0) {
      setShowManageActionsDialog(true);
    } else {
      setShowCreateActionDialog(true);
    }
  };

  const hasCompletedActions = existingActions.some(action => action.status === 'completed');

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {issue.blocks_checkout && (
                <Badge variant="destructive" className="text-xs">
                  OFFLINE
                </Badge>
              )}
              {issue.is_misuse && (
                <Badge variant="secondary" className="text-xs">
                  MISUSE
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(issue.reported_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm break-words">{issue.description}</p>
            {issue.damage_assessment && (
              <p className="text-sm text-orange-600 mt-1">
                <strong>Damage:</strong> {issue.damage_assessment}
              </p>
            )}
            {issue.resolution_photo_urls && issue.resolution_photo_urls.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Resolution Photos:</p>
                <div className="flex gap-1 flex-wrap">
                  {issue.resolution_photo_urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Resolution photo ${index + 1}`}
                      className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAssignScore}
              className={`h-7 px-2 text-xs ${existingScore ? 'border-green-500 border-2' : ''}`}
              title={existingScore ? "View/Edit Score" : "Assign Score"}
            >
              <Target className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManageActions}
              className={`h-7 px-2 text-xs ${
                hasCompletedActions 
                  ? 'border-green-500 border-2' 
                  : existingActions.length > 0 
                    ? 'border-blue-500 border-2' 
                    : ''
              }`}
              title={
                existingActions.length > 0 
                  ? `Manage Actions (${existingActions.length})`
                  : "Create Action"
              }
            >
              {existingActions.length > 0 ? (
                <Swords className="h-3 w-3" />
              ) : (
                <Swords className="h-3 w-3" />
              )}
            </Button>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(issue)}
                className="h-7 px-2 text-xs"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(issue)}
              className="h-7 px-2 text-xs"
              title="Resolve this issue with details"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolve Issue
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={isRemoving}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              title="Remove issue"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>

      <UnifiedActionDialog
        open={showCreateActionDialog}
        onOpenChange={setShowCreateActionDialog}
        context={{
          type: 'issue',
          parentId: issue.id,
          parentTitle: issue.description,
          prefilledData: createIssueAction(issue.id, issue.description)
        }}
        profiles={profiles}
        onActionSaved={() => {
          toast({
            title: "Success",
            description: "Action created successfully from issue"
          });
          setShowCreateActionDialog(false);
          onRefresh();
          // Refresh actions data
          getActionsForIssue(issue.id).then(setExistingActions);
        }}
        isCreating={true}
      />

      <ManageIssueActionsDialog
        open={showManageActionsDialog}
        onOpenChange={setShowManageActionsDialog}
        issue={issue}
        onRefresh={() => {
          onRefresh();
          // Refresh actions data
          getActionsForIssue(issue.id).then(setExistingActions);
        }}
      />

      {tool && (
        <IssueScoreDialog
          open={showScoreDialog}
          onOpenChange={setShowScoreDialog}
          issue={issue}
          tool={tool}
          existingScore={existingScore}
          onScoreUpdated={() => {
            // Refresh the existing score when updated
            getScoreForIssue(issue.id).then(setExistingScore);
          }}
        />
      )}

      <IssueQuickResolveDialog
        open={showQuickResolveDialog}
        onOpenChange={setShowQuickResolveDialog}
        issue={issue as any}
        onSuccess={onRefresh}
      />
    </Card>
  );
}