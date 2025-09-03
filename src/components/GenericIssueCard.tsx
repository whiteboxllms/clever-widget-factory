import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, X, Clock, Edit, Plus, Target, Zap, Package, Wrench, Home, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { BaseIssue, ContextType, getContextBadgeColor, getContextIcon, getContextLabel, OrderIssue, getOrderIssueTypeLabel } from "@/types/issues";
import { useGenericIssues } from "@/hooks/useGenericIssues";
import { useAssetScores } from "@/hooks/useAssetScores";
import { useIssueActions } from "@/hooks/useIssueActions";
import { getIssueTypeIcon, getIssueTypeColor, getContextTypeIcon } from "@/lib/issueTypeUtils";
import { IssueScoreDialog } from "@/components/IssueScoreDialog";
import { UnifiedActionDialog } from "@/components/UnifiedActionDialog";
import { createIssueAction } from "@/types/actions";
import { ManageIssueActionsDialog } from "@/components/ManageIssueActionsDialog";

interface GenericIssueCardProps {
  issue: BaseIssue;
  onResolve?: (issue: BaseIssue) => void;
  onEdit?: (issue: BaseIssue) => void;
  onRefresh: () => void;
  showContext?: boolean;
  enableScorecard?: boolean;
  enableActions?: boolean;
}

export function GenericIssueCard({ 
  issue, 
  onResolve, 
  onEdit, 
  onRefresh,
  showContext = true,
  enableScorecard = false,
  enableActions = false
}: GenericIssueCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [contextEntity, setContextEntity] = useState<any>(null);
  const [existingScore, setExistingScore] = useState<any>(null);
  const [existingActions, setExistingActions] = useState<any[]>([]);
  const [toolForScore, setToolForScore] = useState<any>(null);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showCreateActionDialog, setShowCreateActionDialog] = useState(false);
  const [showManageActionsDialog, setShowManageActionsDialog] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const { removeIssue } = useGenericIssues();
  const { getScoreForIssue } = useAssetScores();
  const { getActionsForIssue } = useIssueActions();

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

  // Fetch context entity information
  useEffect(() => {
    const fetchContextEntity = async () => {
      try {
        let entity = null;
        
        switch (issue.context_type) {
          case 'tool':
            const { data: toolData } = await supabase
              .from('tools')
              .select('name, serial_number')
              .eq('id', issue.context_id)
              .single();
            entity = toolData;
            break;
            
          case 'order':
            const { data: orderData } = await supabase
              .from('parts_orders')
              .select(`
                id, 
                quantity_ordered, 
                supplier_name,
                parts!inner(name, unit)
              `)
              .eq('id', issue.context_id)
              .single();
            entity = orderData;
            break;
            
          default:
            entity = { name: `${issue.context_type} ${issue.context_id}` };
        }
        
        setContextEntity(entity);
      } catch (error) {
        console.error('Error fetching context entity:', error);
      }
    };

    if (showContext) {
      fetchContextEntity();
    }
  }, [issue.context_id, issue.context_type, showContext]);

  // Fetch existing scores and actions when enabled
  useEffect(() => {
    const fetchScoreAndActions = async () => {
      if (enableScorecard && issue.id) {
        try {
          const score = await getScoreForIssue(issue.id);
          setExistingScore(score);
        } catch (error) {
          console.error('Error fetching score:', error);
        }
      }

      if (enableActions && issue.id) {
        try {
          const actions = await getActionsForIssue(issue.id);
          setExistingActions(actions || []);
        } catch (error) {
          console.error('Error fetching actions:', error);
        }
      }
    };

    fetchScoreAndActions();
  }, [issue.id, enableScorecard, enableActions]); // Removed function dependencies that cause infinite loop

  const handleRemove = async () => {
    setIsRemoving(true);
    
    try {
      await removeIssue(issue.id);
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

  const handleAssignScore = async () => {
    if (issue.context_type === 'tool' && issue.context_id) {
      try {
        const { data: tool, error } = await supabase
          .from('tools')
          .select('*')
          .eq('id', issue.context_id)
          .single();

        if (error) {
          console.error('Error fetching tool:', error);
          toast({
            title: "Error",
            description: "Failed to fetch tool details.",
            variant: "destructive",
          });
          return;
        }

        setToolForScore(tool);
        setShowScoreDialog(true);
      } catch (error) {
        console.error('Error in handleAssignScore:', error);
      }
    }
  };

  const handleManageActions = () => {
    if (existingActions.length > 0) {
      setShowManageActionsDialog(true);
    } else {
      setShowCreateActionDialog(true);
    }
  };

  const renderContextualInfo = () => {
    if (!showContext || !contextEntity) return null;

    switch (issue.context_type) {
      case 'tool':
        return (
          <p className="text-xs text-muted-foreground">
            Tool: {contextEntity.name} {contextEntity.serial_number && `(${contextEntity.serial_number})`}
          </p>
        );
        
      case 'order':
        const orderIssue = issue as OrderIssue;
        return (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Order: {contextEntity.parts?.name} - {contextEntity.quantity_ordered} {contextEntity.parts?.unit}</p>
            {contextEntity.supplier_name && (
              <p>Supplier: {contextEntity.supplier_name}</p>
            )}
            {orderIssue.issue_metadata?.expected_quantity && orderIssue.issue_metadata?.actual_quantity_received !== undefined && (
              <p className="text-orange-600">
                Expected: {orderIssue.issue_metadata.expected_quantity}, 
                Received: {orderIssue.issue_metadata.actual_quantity_received}
              </p>
            )}
          </div>
        );
        
      default:
        return (
          <p className="text-xs text-muted-foreground">
            {getContextLabel(issue.context_type)}: {issue.context_id}
          </p>
        );
    }
  };

  const getDisplayIssueType = () => {
    if (issue.context_type === 'order') {
      return getOrderIssueTypeLabel(issue.issue_type);
    }
    return issue.issue_type;
  };

  const isResolved = issue.status === 'resolved';
  const isRemoved = issue.status === 'removed';
  
  const getCardStyles = () => {
    if (isResolved) {
      return 'border-l-[hsl(var(--task-complete-border))] bg-[hsl(var(--task-complete))/0.05]';
    }
    if (isRemoved) {
      return 'border-l-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/0.05] opacity-60';
    }
    return 'border-l-[hsl(var(--primary))]';
  };
  
  return (
    <>
      <Card className={`border-l-4 ${getCardStyles()}`}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {showContext && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getContextBadgeColor(issue.context_type)}`}
                  >
                    {getContextTypeIcon(issue.context_type)}
                    <span className="ml-1">{getContextLabel(issue.context_type)}</span>
                  </Badge>
                )}
                
                 
                 {isResolved && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                {showContext && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(issue.reported_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              {renderContextualInfo()}
              
              <p className="text-sm break-words mt-1">{issue.description}</p>
              
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
              {enableScorecard && issue.context_type === 'tool' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAssignScore}
                  className={`h-7 px-2 text-xs ${existingScore ? 'border-green-500 text-green-600' : ''}`}
                  title={existingScore ? 'View Score' : 'Assign Score'}
                >
                  <Target className="h-3 w-3" />
                </Button>
              )}

              {enableActions && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManageActions}
                  className={`h-7 px-2 text-xs ${
                    existingActions.length > 0 
                      ? existingActions.some(action => action.status === 'completed')
                        ? 'border-green-500 text-green-600'
                        : 'border-blue-500 text-blue-600'
                      : ''
                  }`}
                  title={existingActions.length > 0 ? `Manage Actions (${existingActions.length})` : 'Create Action'}
                >
                  {existingActions.length > 0 ? (
                    <Zap className="h-3 w-3" />
                  ) : (
                    <Zap className="h-3 w-3" />
                  )}
                </Button>
              )}

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
              
              {onResolve && !isResolved && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onResolve(issue)}
                  className="h-7 px-2 text-xs"
                  title="Detailed Resolve"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Resolve
                </Button>
              )}
              
              {!isResolved && (
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
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Dialog */}
      {enableScorecard && toolForScore && (
        <IssueScoreDialog
          open={showScoreDialog}
          onOpenChange={setShowScoreDialog}
          tool={toolForScore}
          issue={issue as any}
          existingScore={existingScore}
          onScoreUpdated={() => {
            setShowScoreDialog(false);
            onRefresh();
          }}
        />
      )}

      {/* Create Action Dialog */}
      {enableActions && (
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
            setShowCreateActionDialog(false);
            onRefresh();
          }}
          isCreating={true}
        />
      )}

      {/* Manage Actions Dialog */}
      {enableActions && (
        <ManageIssueActionsDialog
          open={showManageActionsDialog}
          onOpenChange={setShowManageActionsDialog}
          issue={issue as any}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}