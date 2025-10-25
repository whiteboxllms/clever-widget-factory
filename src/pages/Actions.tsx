import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { useActionProfiles } from '@/hooks/useActionProfiles';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { Bolt, Plus, Filter, Search, CheckCircle, User, AlertTriangle, Wrench, ArrowLeft, Target, X } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ActionScoreDialog } from '@/components/ActionScoreDialog';
import { ScoreButton } from '@/components/ScoreButton';
import { useActionScores, ActionScore } from '@/hooks/useActionScores';
import { BaseAction, Profile } from '@/types/actions';
import { cn, hasActualContent, getActionBorderStyle } from '@/lib/utils';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

// Using unified BaseAction interface from types/actions.ts

export default function Actions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionId } = useParams<{ actionId?: string }>();
  const [actions, setActions] = useState<BaseAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<BaseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('me');
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  
  // Use standardized profiles for consistent "Assigned to" dropdown
  const { profiles } = useActionProfiles();
  const organizationId = useOrganizationId();
  const [scoringAction, setScoringAction] = useState<BaseAction | null>(null);

  // Helper function to get user color
  const getUserColor = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.favorite_color || '#6B7280'; // Default gray if no color set
  };
  const [existingScore, setExistingScore] = useState<ActionScore | null>(null);

  const { getScoreForAction } = useActionScores();

  const fetchSpecificAction = useCallback(async (id: string) => {
    if (!organizationId) return;
    
    try {
      const { data, error } = await supabase
        .from('actions')
        .select(`
          *,
          assignee:organization_members(id, user_id, full_name, role),
          mission:missions(id, title, mission_number, status)
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;

      // Process the action data to match BaseAction interface
      const processedAction: BaseAction = {
        ...data,
        required_stock: Array.isArray(data.required_stock) ? data.required_stock as { part_id: string; quantity: number; part_name: string; }[] : []
      };
      setEditingAction(processedAction);
      setIsEditDialogOpen(true);
      setIsCreating(false);
    } catch (error) {
      console.error('Error fetching specific action:', error);
      toast({
        title: "Error",
        description: "Action not found",
        variant: "destructive",
      });
      navigate('/actions');
    }
  }, [organizationId, navigate]);

  const fetchActions = async () => {
    try {
      const { data, error } = await supabase
        .from('actions')
        .select(`
          *,
          assignee:organization_members(id, user_id, full_name, role),
          mission:missions(id, title, mission_number, status)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch tool info for actions with asset_id
      const assetActions = data?.filter(action => action.asset_id) || [];
      let toolsData = [];
      if (assetActions.length > 0) {
        const { data: tools } = await supabase
          .from('tools')
          .select('id, name, category')
          .in('id', assetActions.map(a => a.asset_id));
        toolsData = tools || [];
      }

      // Fetch tool info for actions with linked_issue_id
      const issueActions = data?.filter(action => action.linked_issue_id) || [];
      let issueToolsData = [];
      let issueToolsInfo = [];
      if (issueActions.length > 0) {
        const { data: issueTools } = await supabase
          .from('issues')
          .select(`
            id,
            context_id,
            context_type
          `)
          .eq('context_type', 'tool')
          .in('id', issueActions.map(a => a.linked_issue_id));
        issueToolsData = issueTools || [];
        
        // Fetch the actual tool information for issue tools
        if (issueToolsData.length > 0) {
          const { data: tools } = await supabase
            .from('tools')
            .select('id, name, category')
            .in('id', issueToolsData.map(issue => issue.context_id));
          issueToolsInfo = tools || [];
        }
      }

      // Fetch participant details for actions that have participants
      const actionsWithParticipants = data?.filter(action => action.participants && action.participants.length > 0) || [];
      let participantsData = [];
      if (actionsWithParticipants.length > 0) {
        const allParticipantIds = actionsWithParticipants.flatMap(action => action.participants || []);
        const uniqueParticipantIds = [...new Set(allParticipantIds)];
        
        if (uniqueParticipantIds.length > 0) {
          try {
            // Use direct table access to organization_members instead of broken RPC
            const { data: participants, error: participantsError } = await supabase
              .from('organization_members')
              .select('user_id, full_name, role')
              .in('user_id', uniqueParticipantIds)
              .eq('is_active', true);
            
            if (participantsError) {
              console.error('Error fetching participants:', participantsError);
              // Continue without participant data rather than failing the entire request
            } else {
              // Map the data to the expected format
              participantsData = (participants || []).map(p => ({
                id: p.user_id,
                user_id: p.user_id,
                full_name: p.full_name || 'Unknown',
                role: p.role || ''
              }));
            }
          } catch (error) {
            console.error('Error in participant fetching:', error);
            // Continue without participant data
          }
        }
      }

      const actions = data?.map(item => ({
        ...item,
        required_stock: Array.isArray(item.required_stock) ? item.required_stock : [],
        participants_details: item.participants?.map(participantId => 
          participantsData.find(p => p.user_id === participantId)
        ).filter((p): p is NonNullable<typeof p> => Boolean(p)) || [],
        asset: toolsData.find(tool => tool.id === item.asset_id) || null,
        assignee: item.assignee && typeof item.assignee === 'object' && !Array.isArray(item.assignee) && !('error' in item.assignee) 
          ? {
              id: (item.assignee as { id: string })?.id || '',
              user_id: (item.assignee as { user_id: string })?.user_id || '',
              full_name: (item.assignee as { full_name: string })?.full_name || '',
              role: (item.assignee as { role: string })?.role || ''
            }
          : null,
        mission: item.mission && typeof item.mission === 'object' && !('error' in item.mission) 
          ? {
              id: item.mission.id || '',
              title: item.mission.title || '',
              mission_number: item.mission.mission_number || 0,
              status: item.mission.status || ''
            }
          : null,
        issue_tool: issueToolsData.find(issue => issue.id === item.linked_issue_id) ? 
          issueToolsInfo.find(tool => tool.id === issueToolsData.find(issue => issue.id === item.linked_issue_id)?.context_id) || null : null
      })) as unknown as BaseAction[] || [];

      // Fetch implementation update counts for all actions
      const actionsWithCounts = await Promise.all(
        actions.map(async (action) => {
          const { count } = await supabase
            .from('action_implementation_updates')
            .select('*', { count: 'exact', head: true })
            .eq('action_id', action.id);
          
          return { ...action, implementation_update_count: count || 0 };
        })
      );

      setActions(actionsWithCounts);
    } catch (error) {
      console.error('Error fetching actions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch actions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Profiles are now handled by useActionProfiles hook for consistency

  const handleEditAction = async (action: BaseAction) => {
    
    // Fetch the latest action data to ensure we have the most up-to-date attachments
    try {
      const { data: latestAction, error } = await supabase
        .from('actions')
        .select('*')
        .eq('id', action.id)
        .single();
      
      if (error) throw error;
      
      // Calculate implementation_update_count like in fetchActions
      const { count } = await supabase
        .from('action_implementation_updates')
        .select('*', { count: 'exact', head: true })
        .eq('action_id', action.id);
      
      const actionWithCount = { ...latestAction, implementation_update_count: count || 0 };
      setEditingAction(actionWithCount as unknown as BaseAction);
    } catch (error) {
      console.error('Error fetching latest action data:', error);
      // Fallback to the action data we have
      setEditingAction(action);
    }
    
    setIsCreating(false);
    setIsEditDialogOpen(true);
  };

  const handleSaveAction = async () => {
    await fetchActions();
    setIsEditDialogOpen(false);
    setEditingAction(null);
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingAction(null);
    setIsCreating(false);
  };

  const handleCreateAction = () => {
    setEditingAction(null);
    setIsCreating(true);
    setIsEditDialogOpen(true);
  };

  const handleScoreAction = async (action: BaseAction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setScoringAction(action);
    
    // Load existing score if any
    if (action.id) {
      const score = await getScoreForAction(action.id);
      setExistingScore(score);
    }
    
    setShowScoreDialog(true);
  };

  const handleScoreUpdated = () => {
    setShowScoreDialog(false);
    setScoringAction(null);
    setExistingScore(null);
    fetchActions(); // Refresh to show updated scores
  };

  useEffect(() => {
    fetchActions();
  }, []);

  // Handle URL parameters for direct action links (both search params and path params)
  useEffect(() => {
    const searchActionId = searchParams.get('action');
    const urlActionId = actionId;
    
    if (searchActionId && actions.length > 0) {
      const action = actions.find(a => a.id === searchActionId);
      if (action) {
        handleEditAction(action);
        // Clear the URL parameter after opening the action
        setSearchParams({});
      }
    } else if (urlActionId && organizationId) {
      // Find the action in the current actions list
      const action = actions.find(a => a.id === urlActionId);
      if (action) {
        setEditingAction(action);
        setIsEditDialogOpen(true);
        setIsCreating(false);
      } else if (actions.length > 0) {
        // If action not found in current list and we have actions loaded, try to fetch it specifically
        fetchSpecificAction(urlActionId);
      }
      // If actions are still loading, wait for them to load first
    }
  }, [actions, searchParams, setSearchParams, actionId, organizationId, fetchSpecificAction]);

  // Reset assignee filter if the selected assignee is not in active profiles
  useEffect(() => {
    if (assigneeFilter !== 'all' && assigneeFilter !== 'me' && assigneeFilter !== 'unassigned') {
      const isAssigneeActive = profiles.some(profile => profile.user_id === assigneeFilter);
      if (!isAssigneeActive) {
        setAssigneeFilter('all');
        toast({
          title: 'Filter Reset',
          description: 'Selected assignee is no longer active and has been cleared from filter',
          variant: 'default'
        });
      }
    }
  }, [profiles, assigneeFilter]);

  useEffect(() => {
    let filtered = actions;

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(action => {
        // Helper function to strip HTML and search
        const stripHtmlAndSearch = (html: string | null | undefined): boolean => {
          if (!html) return false;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const text = doc.body.textContent || '';
          return text.toLowerCase().includes(searchLower);
        };

        return action.title.toLowerCase().includes(searchLower) ||
               action.description?.toLowerCase().includes(searchLower) ||
               stripHtmlAndSearch(action.policy) ||
               stripHtmlAndSearch(action.observations) ||
               action.issue_reference?.toLowerCase().includes(searchLower) ||
               action.asset?.name?.toLowerCase().includes(searchLower) ||
               action.issue_tool?.name?.toLowerCase().includes(searchLower) ||
               action.mission?.title?.toLowerCase().includes(searchLower);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(action => action.status === statusFilter);
    }

    // Assignee filter
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        filtered = filtered.filter(action => !action.assigned_to);
      } else if (assigneeFilter === 'me' && user) {
        filtered = filtered.filter(action => action.assigned_to === user.id);
      } else {
        filtered = filtered.filter(action => action.assigned_to === assigneeFilter);
      }
    }

    setFilteredActions(filtered);
  }, [actions, searchTerm, statusFilter, assigneeFilter, user]);


  const getStatusColor = (status: string, action?: BaseAction) => {
    if (!action) return 'bg-muted text-muted-foreground';
    
    if (status === 'completed') {
      return 'bg-[hsl(var(--action-done)/0.1)] text-[hsl(var(--action-done))] border-[hsl(var(--action-done)/0.2)]';
    }
    
    const hasPolicy = hasActualContent(action.policy);
    const hasImplementationUpdates = action.implementation_update_count && action.implementation_update_count > 0;
    const hasPlanCommitment = action.plan_commitment === true;
    
    
    // Yellow: Implementation updates AND there was first a plan (matches edit dialog logic)
    if (hasImplementationUpdates && hasPolicy && hasPlanCommitment) {
      return 'bg-[hsl(var(--action-progress)/0.1)] text-[hsl(var(--action-progress))] border-[hsl(var(--action-progress)/0.2)]';
    }
    
    // Blue: Ready to work (when BOTH plan_commitment is true AND has policy)
    if (hasPolicy && hasPlanCommitment) {
      return 'bg-background text-[hsl(var(--action-ready))] border-[hsl(var(--action-ready)/0.2)]';
    }
    
    return 'bg-muted text-muted-foreground';
  };

  // Sort actions: in-progress first, then by updated_at (most recent first)
  const sortedFilteredActions = [...filteredActions].sort((a, b) => {
    // First priority: in-progress status
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    
    // Within same status group, sort by updated_at (most recent first)
    const aUpdated = new Date(a.updated_at).getTime();
    const bUpdated = new Date(b.updated_at).getTime();
    return bUpdated - aUpdated;
  });

  const unresolved = sortedFilteredActions.filter(a => a.status !== 'completed');
  const completed = sortedFilteredActions
    .filter(a => a.status === 'completed')
    .sort((a, b) => {
      // Sort completed actions by completion date (most recent first)
      if (a.completed_at && b.completed_at) {
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      }
      // If one doesn't have a completion date, prioritize the one that does
      if (a.completed_at && !b.completed_at) return -1;
      if (!a.completed_at && b.completed_at) return 1;
      // If neither has a completion date, sort by updated_at (fallback)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  
  // Use active profiles for assignee filter options
  const assigneeOptions = profiles.map(profile => ({
    user_id: profile.user_id,
    full_name: profile.full_name
  }));

  if (loading) {
    return (
      <div className="container mx-auto p-2 sm:p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading actions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full min-w-0">
          <Button variant="outline" onClick={() => navigate('/')} className="!whitespace-normal text-left min-w-0">
            <ArrowLeft className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="break-words">Back to Dashboard</span>
          </Button>
          <Bolt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Actions</h1>
            <p className="text-muted-foreground">Track and manage actions</p>
          </div>
        </div>
        <Button onClick={handleCreateAction} className="w-full sm:w-auto !whitespace-normal min-w-0">
          <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="break-words">New Action</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </label>
              <div className="relative">
                <Input
                  placeholder="Search actions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Assignee</label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="me">Assigned to Me</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assigneeOptions.map((assignee) => (
                    <SelectItem key={assignee.user_id} value={assignee.user_id}>
                      {assignee.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="unresolved" className="w-full">
        <TabsList>
          <TabsTrigger value="unresolved" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Unresolved ({unresolved.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="unresolved" className="space-y-4">
          {unresolved.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bolt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No unresolved actions</h3>
                <p className="text-muted-foreground">All actions are completed or none match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {unresolved.map(action => {
                const hasImplementation = hasActualContent(action.observations);
                const hasPolicy = hasActualContent(action.policy);
                
                const borderStyle = getActionBorderStyle(action);
                
                 return (
                   <Card 
                     key={action.id} 
                     className={cn(
                       "hover:shadow-md transition-shadow cursor-pointer overflow-hidden",
                       borderStyle.borderColor,
                       borderStyle.bgColor,
                       borderStyle.textColor
                     )}
                     onClick={() => handleEditAction(action)}
                   >
                     <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold break-words leading-tight break-all">{action.title}</h3>
                              <div className="text-xs text-muted-foreground mt-1">
                                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1">
                                  <span>Updated: {new Date(action.updated_at).toLocaleDateString('en-US', { 
                                    year: '2-digit', 
                                    month: 'numeric', 
                                    day: 'numeric' 
                                  }) + ' ' + new Date(action.updated_at).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}</span>
                                  {action.estimated_completion_date && (
                                    <span>Expected: {new Date(action.estimated_completion_date).toLocaleDateString('en-US', { 
                                      year: '2-digit', 
                                      month: 'numeric', 
                                      day: 'numeric' 
                                    }) + ' ' + new Date(action.estimated_completion_date).toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <ScoreButton action={action} onScoreAction={handleScoreAction} />
                            </div>
                          </div>
                          
                          {action.description && (
                            <p className="text-muted-foreground break-words break-all">{action.description}</p>
                          )}
                          
                          <div className="flex flex-wrap gap-2 overflow-hidden">
                            {/* Action Type Indicator */}
                             {action.asset ? (
                               <Badge variant="outline" className="bg-blue-100 text-blue-600 border-blue-300 max-w-full overflow-hidden">
                                 <span className="truncate">Asset: {action.asset.name.length > 10 ? `${action.asset.name.substring(0, 10)}...` : action.asset.name}</span>
                               </Badge>
                            ) : action.issue_tool ? (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 max-w-full overflow-hidden">
                                <span className="truncate">Issue Tool: {action.issue_tool.name.length > 10 ? `${action.issue_tool.name.substring(0, 10)}...` : action.issue_tool.name}</span>
                              </Badge>
                            ) : null}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 overflow-hidden">
                            {action.mission && (
                              <Badge variant="outline" className="bg-indigo-100 text-indigo-800 max-w-full overflow-hidden">
                                <span className="truncate">Mission #{action.mission.mission_number}: {action.mission.title.length > 15 ? `${action.mission.title.substring(0, 15)}...` : action.mission.title}</span>
                              </Badge>
                            )}
                            
                            {action.assignee ? (
                              <Badge 
                                variant="outline" 
                                className="flex items-center gap-1 max-w-full overflow-hidden"
                                style={{ 
                                  borderColor: getUserColor(action.assignee.user_id),
                                  color: getUserColor(action.assignee.user_id)
                                }}
                              >
                                <User className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate max-w-[80px]">{action.assignee.full_name}</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600">
                                Unassigned
                              </Badge>
                            )}
                            
                            {action.participants_details && action.participants_details.length > 0 && (
                              action.participants_details.map(participant => (
                                <Badge 
                                  key={participant.user_id} 
                                  variant="secondary" 
                                  className="flex items-center gap-1 max-w-full overflow-hidden"
                                  style={{ 
                                    borderColor: getUserColor(participant.user_id),
                                    color: getUserColor(participant.user_id)
                                  }}
                                >
                                  <User className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate max-w-[80px]">{participant.full_name}</span>
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                        </div>
                      </CardContent>
                    </Card>
                 );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {completed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed actions</h3>
                <p className="text-muted-foreground">No actions have been completed yet or none match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
               {completed.map(action => (
                 <Card 
                   key={action.id} 
                   className="hover:shadow-md transition-shadow cursor-pointer border-2 border-[hsl(var(--action-done-border))] overflow-hidden"
                   onClick={() => handleEditAction(action)}
                 >
                   <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold break-words leading-tight break-all">{action.title}</h3>
                              <div className="text-xs text-muted-foreground mt-1">
                                 <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1">
                                   <span>Updated: {new Date(action.updated_at).toLocaleDateString('en-US', { 
                                     year: '2-digit', 
                                     month: 'numeric', 
                                     day: 'numeric' 
                                   }) + ' ' + new Date(action.updated_at).toLocaleTimeString('en-US', {
                                     hour: 'numeric',
                                     minute: '2-digit',
                                     hour12: true
                                   })}</span>
                                 </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <ScoreButton action={action} onScoreAction={handleScoreAction} />
                            </div>
                          </div>
                          
                          {action.description && (
                            <p className="text-muted-foreground break-words break-all">{action.description}</p>
                          )}
                          
                          <div className="flex flex-wrap gap-2 overflow-hidden">
                            <Badge variant="outline" className={getStatusColor(action.status, action)}>
                              Done
                            </Badge>
                            
                            {/* Action Type Indicator */}
                            {action.asset ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 max-w-full overflow-hidden">
                              <span className="truncate">Asset: {action.asset.name.length > 10 ? `${action.asset.name.substring(0, 10)}...` : action.asset.name}</span>
                            </Badge>
                            ) : action.issue_tool ? (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 max-w-full overflow-hidden">
                                <span className="truncate">Issue Tool: {action.issue_tool.name.length > 10 ? `${action.issue_tool.name.substring(0, 10)}...` : action.issue_tool.name}</span>
                              </Badge>
                            ) : null}
                          </div>
                          
                          <div className="flex flex-wrap gap-2 overflow-hidden">
                            {action.mission && (
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-800 max-w-full overflow-hidden">
                              <span className="truncate">Mission #{action.mission.mission_number}: {action.mission.title.length > 15 ? `${action.mission.title.substring(0, 15)}...` : action.mission.title}</span>
                            </Badge>
                            )}
                            
                             {action.assignee ? (
                               <Badge variant="outline" className="flex items-center gap-1 max-w-full overflow-hidden">
                                 <User className="h-3 w-3 flex-shrink-0" />
                                 <span className="truncate max-w-[80px]">{action.assignee.full_name}</span>
                               </Badge>
                             ) : (
                               <Badge variant="outline" className="text-orange-600">
                                 Unassigned
                               </Badge>
                             )}
                             
                             {action.participants_details && action.participants_details.length > 0 && (
                               action.participants_details.map(participant => (
                                 <Badge key={participant.user_id} variant="secondary" className="flex items-center gap-1 max-w-full overflow-hidden">
                                   <User className="h-3 w-3 flex-shrink-0" />
                                   <span className="truncate max-w-[80px]">{participant.full_name}</span>
                                 </Badge>
                               ))
                             )}
                          </div>
                        </div>
                        </div>
                      </CardContent>
                    </Card>
                ))}
             </div>
           )}
         </TabsContent>
       </Tabs>

       {/* Action Dialog */}
        <UnifiedActionDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCancelEdit();
              // Clear URL parameter when dialog is closed
              if (actionId) {
                navigate('/actions');
              }
            }
          }}
          action={editingAction || undefined}
          onActionSaved={handleSaveAction}
          profiles={profiles}
       />

       {/* Score Dialog */}
       {scoringAction && (
         <ActionScoreDialog
           open={showScoreDialog}
           onOpenChange={setShowScoreDialog}
           action={scoringAction}
           existingScore={existingScore}
           onScoreUpdated={handleScoreUpdated}
         />
       )}
    </div>
  );
}