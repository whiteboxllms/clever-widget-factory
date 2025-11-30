import { useState, useEffect, useCallback } from "react";
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, X, Clock, Edit, Plus, Target, Swords, Package, Wrench, Home, FileText } from "lucide-react";
import { apiService } from '@/lib/apiService';
import { BaseAction } from '@/types/actions';
import { toast } from "@/hooks/use-toast";
import { BaseIssue, ContextType, getContextBadgeColor, getContextIcon, getContextLabel, OrderIssue, getOrderIssueTypeLabel } from "@/types/issues";
import { useGenericIssues } from "@/hooks/useGenericIssues";
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";
import { useAssetScores } from "@/hooks/useAssetScores";
import { useIssueActions } from "@/hooks/useIssueActions";
import { offlineQueryConfig } from '@/lib/queryConfig';
import { issueScoreQueryKey, issueActionsQueryKey } from '@/lib/queryKeys';
import { getIssueTypeIcon, getIssueTypeColor, getContextTypeIcon } from "@/lib/issueTypeUtils";
import { IssueScoreDialog } from "@/components/IssueScoreDialog";
import { UnifiedActionDialog } from "@/components/UnifiedActionDialog";
import { createIssueAction } from "@/types/actions";
import { ManageIssueActionsDialog } from "@/components/ManageIssueActionsDialog";
import { FiveWhysDialog } from "@/components/FiveWhysDialog";
import { FiveWhysSessionSelector } from "@/components/FiveWhysSessionSelector";
import { FiveWhysSessionViewer } from "@/components/FiveWhysSessionViewer";
import { useAuth } from "@/hooks/useCognitoAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { listSessions } from '@/services/fiveWhysService';

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
  const [showFiveWhysSelector, setShowFiveWhysSelector] = useState(false);
  const [showFiveWhysDialog, setShowFiveWhysDialog] = useState(false);
  const [showFiveWhysViewer, setShowFiveWhysViewer] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [hasFiveWhysSession, setHasFiveWhysSession] = useState(false);
  const { user } = useAuth();
  const organizationId = useOrganizationId();
  const { members: organizationMembers } = useOrganizationMembers();
  const { removeIssue, resolveIssue } = useGenericIssues();
  
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
  const { getScoreForIssue } = useAssetScores();
  const { getActionsForIssue } = useIssueActions();

  // Profiles now sourced from useOrganizationMembers (active members in current org)

  // Use TanStack Query for scores and actions with proper caching
  const scoreQuery = useQuery({
    queryKey: issueScoreQueryKey(issue.id),
    queryFn: () => getScoreForIssue(issue.id),
    enabled: enableScorecard && !!issue.id,
    ...offlineQueryConfig,
    staleTime: 10 * 60 * 1000, // 10 minutes - scores don't change often
  });

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
    enabled: enableActions && !!issue.id,
    ...offlineQueryConfig,
    staleTime: 0,
  });

  // Update state when queries resolve
  useEffect(() => {
    if (scoreQuery.data !== undefined) {
      setExistingScore(scoreQuery.data);
    }
  }, [scoreQuery.data]);

  useEffect(() => {
    if (actionsQuery.data !== undefined) {
      setExistingActions(actionsQuery.data || []);
    }
  }, [actionsQuery.data]);

  // Fetch context entity information
  useEffect(() => {
    const fetchContextEntity = async () => {
      try {
        let entity = null;
        
        switch (issue.context_type) {
          case 'tool':
            const toolResponse = await apiService.get(`/tools/${issue.context_id}`);
            entity = toolResponse.data;
            break;
            
          case 'order':
            const orderResponse = await apiService.get(`/parts_orders/${issue.context_id}`);
            entity = orderResponse.data;
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


  // Check if 5 Whys session exists for this issue
  const checkFiveWhysSession = useCallback(async () => {
    if (!organizationId || !issue.id) return;
    
    try {
      const result = await listSessions(issue.id, organizationId);
      if (result.success && result.data?.sessions) {
        // Check if any session has conversation history or root cause analysis
        const hasData = result.data.sessions.some(session => 
          (Array.isArray(session.conversation_history) && session.conversation_history.length > 0) ||
          (session.root_cause_analysis && session.root_cause_analysis.trim().length > 0)
        );
        setHasFiveWhysSession(hasData);
      } else {
        setHasFiveWhysSession(false);
      }
    } catch (error) {
      console.error('Error checking 5 Whys sessions:', error);
      setHasFiveWhysSession(false);
    }
  }, [issue.id, organizationId]);

  useEffect(() => {
    checkFiveWhysSession();
  }, [checkFiveWhysSession]);

  // Refresh session check when dialog closes (user may have completed a session)
  useEffect(() => {
    if (!showFiveWhysDialog && !showFiveWhysSelector && !showFiveWhysViewer) {
      // All dialogs are closed, refresh the session check
      checkFiveWhysSession();
    }
  }, [showFiveWhysDialog, showFiveWhysSelector, showFiveWhysViewer, checkFiveWhysSession]);

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
        const response = await apiService.get(`/tools/${issue.context_id}`);
        setToolForScore(response.data);
        setShowScoreDialog(true);
      } catch (error) {
        console.error('Error in handleAssignScore:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tool details.",
          variant: "destructive",
        });
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
        <CardContent className="p-4 sm:p-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-2">
            <div className="flex-1 min-w-0 space-y-2 sm:space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2 flex-wrap">
                {showContext && (
                  <Badge 
                    variant="outline" 
                    className={`text-sm sm:text-xs ${getContextBadgeColor(issue.context_type)}`}
                  >
                    {getContextTypeIcon(issue.context_type)}
                    <span className="ml-1">{getContextLabel(issue.context_type)}</span>
                  </Badge>
                )}
                
                 {isResolved && (
                    <Badge variant="outline" className="text-sm sm:text-xs bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Resolved
                    </Badge>
                  )}
                {showContext && (
                  <span className="text-sm sm:text-xs text-muted-foreground">
                    {new Date(issue.reported_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              {renderContextualInfo()}
              
              <p className="text-sm break-words">{issue.description}</p>

              {issue.damage_assessment && (
                <p className="text-sm text-orange-600">
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
            
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowFiveWhysSelector(true)}
                  className={`min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs ${
                    hasFiveWhysSession
                      ? 'border-green-500 text-green-600 hover:bg-green-50'
                      : 'border-gray-900 text-gray-900 hover:bg-gray-50'
                  }`}
                  title="5 Whys Analysis"
                >
                  <span>5Ys</span>
                </Button>

                {enableScorecard && issue.context_type === 'tool' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAssignScore}
                    className={`min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs ${existingScore ? 'border-green-500 text-green-600' : ''}`}
                    title={existingScore ? 'View Score' : 'Assign Score'}
                  >
                    <Target className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Score</span>
                  </Button>
                )}

                {enableActions && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManageActions}
                    className={`min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs ${
                      existingActions.length > 0 
                        ? existingActions.some(action => action.status === 'completed')
                          ? 'border-green-500 text-green-600'
                          : 'border-blue-500 text-blue-600'
                        : ''
                    }`}
                    title={existingActions.length > 0 ? `Manage Actions (${existingActions.length})` : 'Create Action'}
                  >
                    <Swords className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-0" />
                    <span className="sm:hidden">
                      {existingActions.length > 0 ? `Actions (${existingActions.length})` : 'Actions'}
                    </span>
                  </Button>
                )}

                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(issue)}
                    className="min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs"
                  >
                    <Edit className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Edit</span>
                  </Button>
                )}
                
                {!isResolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await resolveIssue(issue.id);
                        onRefresh();
                      } catch (error) {
                        console.error('Error resolving issue:', error);
                      }
                    }}
                    className="min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs"
                    title="Resolve Issue"
                  >
                    <CheckCircle className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-1" />
                    <span className="hidden sm:inline">Resolve</span>
                    <span className="sm:hidden">Resolve</span>
                  </Button>
                )}
                
                {!isResolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRemove}
                    disabled={isRemoving}
                    className="min-h-[44px] sm:min-h-0 h-10 sm:h-7 px-3 sm:px-2 py-2 sm:py-1 text-sm sm:text-xs text-destructive hover:text-destructive"
                    title="Remove issue"
                  >
                    <X className="h-4 w-4 sm:h-3 sm:w-3 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Remove</span>
                  </Button>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground text-right">
                Created: {new Date(issue.reported_at).toLocaleDateString()} {new Date(issue.reported_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
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
          prefilledData: createIssueAction(
            issue.id, 
            issue.description, // Just description, no damage_assessment for generic issues
            issue.context_type === 'tool' ? issue.context_id : undefined
          )
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

      {/* 5 Whys Session Selector */}
      {user && organizationId && (
        <FiveWhysSessionSelector
          open={showFiveWhysSelector}
          onOpenChange={setShowFiveWhysSelector}
          issue={issue}
          organizationId={organizationId}
          currentUserId={user.id}
          onViewSession={(sessionId) => {
            setSelectedSessionId(sessionId);
            setShowFiveWhysSelector(false);
            setShowFiveWhysViewer(true);
          }}
          onCreateNew={() => {
            setSelectedSessionId(null);
            setShowFiveWhysSelector(false);
            setShowFiveWhysDialog(true);
          }}
          onContinueSession={(sessionId) => {
            setSelectedSessionId(sessionId);
            setShowFiveWhysSelector(false);
            setShowFiveWhysDialog(true);
          }}
        />
      )}

      {/* 5 Whys Dialog */}
      <FiveWhysDialog
        open={showFiveWhysDialog}
        onOpenChange={setShowFiveWhysDialog}
        issue={issue}
        sessionId={selectedSessionId || undefined}
      />

      {/* 5 Whys Session Viewer */}
      {selectedSessionId && organizationId && (
        <FiveWhysSessionViewer
          open={showFiveWhysViewer}
          onOpenChange={setShowFiveWhysViewer}
          sessionId={selectedSessionId}
          organizationId={organizationId}
          issueDescription={issue.description}
        />
      )}
    </>
  );
}