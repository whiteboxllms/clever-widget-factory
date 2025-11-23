import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useCognitoAuth";
import { toast } from '@/hooks/use-toast';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { Bolt, Plus, Filter, Search, CheckCircle, User, AlertTriangle, Wrench, ArrowLeft, Target, X } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ActionScoreDialog } from '@/components/ActionScoreDialog';
import { ScoreButton } from '@/components/ScoreButton';
import { useActionScores, ActionScore } from '@/hooks/useActionScores';
import { BaseAction, Profile } from '@/types/actions';
import { cn, hasActualContent, getActionBorderStyle } from '@/lib/utils';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiService } from '@/lib/apiService';

// Using unified BaseAction interface from types/actions.ts

export default function Actions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionId } = useParams<{ actionId?: string }>();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('me');
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  
  // Use organization members for consistent "Assigned to" dropdown
  const { members: profiles } = useOrganizationMembers();
  const organizationId = useOrganizationId();
  const [scoringAction, setScoringAction] = useState<BaseAction | null>(null);

  // Helper function to get user color
  const getUserColor = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.favorite_color || '#6B7280'; // Default gray if no color set
  };
  const [existingScore, setExistingScore] = useState<ActionScore | null>(null);
  const processedUrlRef = useRef<string | null>(null);

  const { getScoreForAction } = useActionScores();

  const fetchActions = async () => {
    const result = await apiService.get('/actions');
    return result.data || [];
  };

  const { data: actions = [], isLoading: loading } = useQuery({
    queryKey: ['actions'],
    queryFn: fetchActions,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const fetchSpecificAction = useCallback(async (id: string) => {
    if (!organizationId) return;
    
    try {
      const action = actions.find((a: any) => a.id === id);
      
      if (!action) {
        throw new Error('Action not found');
      }

      setEditingAction(action);
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

  // Profiles are now handled by useActionProfiles hook for consistency

  const handleEditAction = async (action: BaseAction) => {
    setEditingAction(action);
    setIsCreating(false);
    setIsEditDialogOpen(true);
  };

  const queryClient = useQueryClient();
  
  const handleSaveAction = async () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] });
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
    console.log('Setting scoring action:', action.id, action.title); // Debug log
    setScoringAction(action);
    
    // Load existing score if any
    if (action.id) {
      const score = await getScoreForAction(action.id);
      console.log('Existing score for action:', score); // Debug log
      setExistingScore(score);
    }
    
    setShowScoreDialog(true);
  };

  const handleScoreUpdated = () => {
    setShowScoreDialog(false);
    setScoringAction(null);
    setExistingScore(null);
  };

  const handleScoreDialogClose = (open: boolean) => {
    if (!open) {
      setScoringAction(null);
      setExistingScore(null);
    }
    setShowScoreDialog(open);
  };



  // Handle URL parameters for direct action links (both search params and path params)
  useEffect(() => {
    const searchActionId = searchParams.get('action');
    const urlActionId = actionId;
    const currentId = searchActionId || urlActionId;
    
    // Skip if we've already processed this ID or no actions loaded yet
    if (!currentId || processedUrlRef.current === currentId || actions.length === 0) {
      return;
    }
    
    if (searchActionId && actions.length > 0) {
      const action = actions.find(a => a.id === searchActionId);
      if (action) {
        handleEditAction(action);
        processedUrlRef.current = searchActionId;
        // Clear the URL parameter after opening the action
        setSearchParams({});
      }
    } else if (urlActionId && organizationId && actions.length > 0) {
      // Find the action in the current actions list
      const action = actions.find(a => a.id === urlActionId);
      if (action) {
        setEditingAction(action);
        setIsEditDialogOpen(true);
        setIsCreating(false);
        processedUrlRef.current = urlActionId;
      } else {
        // If action not found in current list, show error
        toast({
          title: "Error",
          description: "Action not found",
          variant: "destructive",
        });
        navigate('/actions');
        processedUrlRef.current = urlActionId;
      }
    }
  }, [actions.length, actionId, organizationId, searchParams]);

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

  const filteredActions = useMemo(() => {
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
        // Find the user's database user_id based on their Cognito user ID
        const currentUserProfile = profiles.find(p => p.cognito_user_id === user.userId);
        if (currentUserProfile) {
          filtered = filtered.filter(action => action.assigned_to === currentUserProfile.user_id);
        } else {
          // Fallback: check if Cognito user ID matches user_id directly (like Stefan's case)
          filtered = filtered.filter(action => action.assigned_to === user.userId);
        }
      } else {
        filtered = filtered.filter(action => action.assigned_to === assigneeFilter);
      }
    }

    return filtered;
  }, [actions, searchTerm, statusFilter, assigneeFilter, user?.userId, profiles.length]);


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
                                <span className="truncate">Project #{action.mission.mission_number}: {action.mission.title.length > 15 ? `${action.mission.title.substring(0, 15)}...` : action.mission.title}</span>
                              </Badge>
                            )}
                            
                            {action.assigned_to ? (
                              <Badge 
                                variant="outline" 
                                className="flex items-center gap-1 max-w-full overflow-hidden"
                              >
                                <User className="h-3 w-3 flex-shrink-0" />
                                <span 
                                  className="truncate max-w-[80px]"
                                  style={{ color: action.assigned_to_color || getUserColor(action.assigned_to) }}
                                >
                                  {action.assigned_to_name || profiles.find(p => p.user_id === action.assigned_to)?.full_name || 'Unknown User'}
                                </span>
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
                                    borderColor: participant.favorite_color || getUserColor(participant.user_id),
                                    color: participant.favorite_color || getUserColor(participant.user_id)
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
                              <span className="truncate">Project #{action.mission.mission_number}: {action.mission.title.length > 15 ? `${action.mission.title.substring(0, 15)}...` : action.mission.title}</span>
                            </Badge>
                            )}
                            
                             {action.assigned_to ? (
                               <Badge variant="outline" className="flex items-center gap-1 max-w-full overflow-hidden">
                                 <User className="h-3 w-3 flex-shrink-0" />
                                 <span 
                                   className="truncate max-w-[80px]"
                                   style={{ color: action.assigned_to_color || getUserColor(action.assigned_to) }}
                                 >
                                   {action.assigned_to_name || profiles.find(p => p.user_id === action.assigned_to)?.full_name || 'Unknown User'}
                                 </span>
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
          isCreating={isCreating}
       />

       {/* Score Dialog */}
       {scoringAction && (
         <ActionScoreDialog
           open={showScoreDialog}
           onOpenChange={handleScoreDialogClose}
           action={scoringAction}
           existingScore={existingScore}
           onScoreUpdated={handleScoreUpdated}
         />
       )}
    </div>
  );
}