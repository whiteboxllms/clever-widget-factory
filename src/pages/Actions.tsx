import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useCognitoAuth";
import { toast } from '@/hooks/use-toast';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { Bolt, Plus, Filter, Search, CheckCircle, AlertTriangle, ArrowLeft, X, SearchCheck, Info } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ActionScoreDialog } from '@/components/ActionScoreDialog';
import { ActionListItemCard } from '@/components/ActionListItemCard';
import { useActionScores, ActionScore } from '@/hooks/useActionScores';
import { BaseAction, Profile } from '@/types/actions';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiService } from '@/lib/apiService';
import { actionsQueryKey, actionQueryKey } from '@/lib/queryKeys';

// Using unified BaseAction interface from types/actions.ts

export default function Actions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { actionId } = useParams<{ actionId?: string }>();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('me');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<string[]>([]);
  
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

  const fetchSingleAction = async (id: string) => {
    const result = await apiService.get(`/actions?id=${id}`);
    const actions = result.data || [];
    return actions[0] || null;
  };

  const queryClient = useQueryClient();

  // If we have an actionId in URL, check cache first, then fetch only if needed
  const hasActionIdInUrl = !!actionId || !!searchParams.get('action');
  const targetActionId = actionId || searchParams.get('action') || '';
  
  // Check if action is already in cache (from save mutation or previous fetch)
  const cachedActionsForLookup = queryClient.getQueryData<BaseAction[]>(actionsQueryKey());
  const cachedAction = targetActionId ? cachedActionsForLookup?.find(a => a.id === targetActionId) : undefined;
  
  // Only fetch single action if we have an actionId AND it's not in cache
  const { data: singleAction, isLoading: singleActionLoading } = useQuery({
    queryKey: actionQueryKey(targetActionId),
    queryFn: () => fetchSingleAction(targetActionId),
    enabled: hasActionIdInUrl && !!targetActionId && !cachedAction, // Only fetch if not in cache
    ...offlineQueryConfig,
    onSuccess: (action) => {
      // Update the actions list cache with this single action
      if (action) {
        queryClient.setQueryData<BaseAction[]>(actionsQueryKey(), (old) => {
          if (!old) return [action];
          const existingIndex = old.findIndex(a => a.id === action.id);
          if (existingIndex >= 0) {
            // Update existing action in cache
            const updated = [...old];
            updated[existingIndex] = action;
            return updated;
          }
          // Add new action to cache
          return [...old, action];
        });
      }
    },
  });
  
  // Use cached action if available, otherwise use fetched single action
  const singleActionData = cachedAction || singleAction;

  // Fetch all actions - but NOT when dialog is open (actions are already in cache from initial load/mutations)
  // Also check if we already have cached data to avoid unnecessary fetches
  // This prevents the 639KB refetch when clicking edit on an action
  const hasCachedActionsData = cachedActionsForLookup && cachedActionsForLookup.length > 0;
  const shouldFetchAllActions = !isEditDialogOpen && !hasCachedActionsData;
  
  const { data: actions = [], isLoading: allActionsLoading } = useQuery({
    queryKey: actionsQueryKey(),
    queryFn: fetchActions,
    enabled: shouldFetchAllActions,
    ...offlineQueryConfig,
    // Override refetchOnMount to prevent refetch when we have cached data
    refetchOnMount: !hasCachedActionsData,
    // Prevent refetch on window focus or reconnect when we have cached data
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  
  // Get cached actions (will be available even when query is disabled)
  const cachedActionsList = queryClient.getQueryData<BaseAction[]>(actionsQueryKey()) || actions;

  // Combine actions from both sources
  // Priority: use cached actions (they're up-to-date from mutations), merge single action if needed
  const allActions = useMemo(() => {
    // Use cached actions if available (they're already up-to-date from mutations)
    const actionsToUse = cachedActionsList && cachedActionsList.length > 0 ? cachedActionsList : actions;
    
    // If we have a single action (from URL fetch), merge it with cached actions
    if (hasActionIdInUrl && singleActionData) {
      const existingIndex = actionsToUse.findIndex(a => a.id === singleActionData.id);
      if (existingIndex >= 0) {
        const updated = [...actionsToUse];
        updated[existingIndex] = singleActionData;
        return updated;
      }
      return [...actionsToUse, singleActionData];
    }
    
    return actionsToUse;
  }, [hasActionIdInUrl, singleActionData, actions, cachedActionsList]);

  // Loading state: if we have actionId and dialog is open, check if we're loading the single action
  // But if action is in cache, we're not loading
  const loading = hasActionIdInUrl && isEditDialogOpen 
    ? (!cachedAction && singleActionLoading) 
    : allActionsLoading;

  // Removed fetchSpecificAction - now handled by useQuery above

  // Profiles are now handled by useActionProfiles hook for consistency

  const handleEditAction = async (action: BaseAction) => {
    setEditingActionId(action.id);
    setIsCreating(false);
    setIsEditDialogOpen(true);
  };

  const handleSaveAction = async () => {
    // Cache is already updated by saveActionMutation.onSuccess
    // Don't close dialog immediately - let the mutation's onSuccess handle it
    // This prevents navigation/reload issues
    setIsEditDialogOpen(false);
    setEditingActionId(null);
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingActionId(null);
    setIsCreating(false);
    // If we navigated here with an actionId, go back to main actions page
    if (actionId) {
      navigate('/actions');
    }
  };

  const handleCreateAction = () => {
    setEditingActionId(null);
    setIsCreating(true);
    setIsEditDialogOpen(true);
  };

  const handleScoreAction = async (action: BaseAction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    console.log('[Actions] handleScoreAction called', {
      actionId: action.id,
      actionTitle: action.title
    });
    setScoringAction(action);
    
    // Open dialog immediately
    setShowScoreDialog(true);
    
    // Load existing score in parallel (non-blocking)
    if (action.id) {
      console.log('[Actions] Loading existing score for action:', action.id);
      getScoreForAction(action.id).then(score => {
        console.log('[Actions] Existing score loaded:', score ? {
          id: score.id,
          action_id: score.action_id,
          hasAiResponse: !!score.ai_response
        } : null);
        setExistingScore(score);
      });
    }
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

  const handleSemanticSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search term for semantic search",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSemanticSearch(true);
      
      // Call unified search API with entity_types filter for actions
      const response = await apiService.post('/semantic-search/unified', {
        query: searchTerm,
        entity_types: ['action', 'action_existing_state'],
        limit: 50
      });

      console.log('Semantic search response:', response);

      if (response.data && response.data.results && Array.isArray(response.data.results)) {
        // Extract unique action IDs from results
        const actionIds = [...new Set(response.data.results.map((r: any) => r.entity_id))];
        setSemanticResults(actionIds);
        
        toast({
          title: "Semantic Search Complete",
          description: `Found ${actionIds.length} relevant actions`,
        });
      } else {
        console.error('Unexpected response format:', response);
        throw new Error('Invalid response format from search API');
      }
    } catch (error) {
      console.error('Semantic search error:', error);
      toast({
        title: "Search Error",
        description: error instanceof Error ? error.message : "Failed to perform semantic search. Please try again.",
        variant: "destructive",
      });
      setIsSemanticSearch(false);
      setSemanticResults([]);
    }
  };

  const handleClearSemanticSearch = () => {
    setIsSemanticSearch(false);
    setSemanticResults([]);
  };



  // Handle URL parameters for direct action links (both search params and path params)
  useEffect(() => {
    const searchActionId = searchParams.get('action');
    const urlActionId = actionId;
    const currentId = searchActionId || urlActionId;
    
    // Skip if we've already processed this ID
    if (!currentId || processedUrlRef.current === currentId) {
      return;
    }
    
    // Wait for the action to be loaded (from cache or single fetch)
    // Use singleActionData (direct fetch) or cachedAction (from cache) - don't use allActions
    // to avoid infinite loop when allActions array reference changes
    const action = singleActionData || cachedAction;
    
    if (searchActionId) {
      if (action) {
        setEditingActionId(searchActionId);
        setIsEditDialogOpen(true);
        setIsCreating(false);
        processedUrlRef.current = searchActionId;
        // Clear the URL parameter after opening the action
        setSearchParams({});
      } else if (!singleActionLoading && !allActionsLoading && !cachedAction) {
        // Action not found after loading completed and not in cache
        toast({
          title: "Error",
          description: "Action not found",
          variant: "destructive",
        });
        navigate('/actions');
        processedUrlRef.current = searchActionId;
      }
    } else if (urlActionId && organizationId) {
      if (action) {
        setEditingActionId(urlActionId);
        setIsEditDialogOpen(true);
        setIsCreating(false);
        processedUrlRef.current = urlActionId;
      } else if (!singleActionLoading && !allActionsLoading && !cachedAction) {
        // Action not found after loading completed and not in cache
        toast({
          title: "Error",
          description: "Action not found",
          variant: "destructive",
        });
        navigate('/actions');
        processedUrlRef.current = urlActionId;
      }
    }
  }, [actionId, organizationId, searchParams, singleActionData, singleActionLoading, allActionsLoading, cachedAction, navigate, setSearchParams]);

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
    let filtered = allActions;

    // Semantic search filter (takes precedence)
    if (isSemanticSearch && semanticResults.length > 0) {
      filtered = filtered.filter(action => semanticResults.includes(action.id));
    } else if (searchTerm) {
      // Regular text search filter
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
  }, [allActions, searchTerm, statusFilter, assigneeFilter, user?.userId, profiles.length, isSemanticSearch, semanticResults]);

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
  const assigneeOptions = profiles
    .filter(profile => profile.is_active !== false)
    .map(profile => ({
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
        <Button onClick={handleCreateAction} variant="outline" className="w-full sm:w-auto whitespace-nowrap min-w-0">
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
                {isSemanticSearch && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    AI Search Active
                  </span>
                )}
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search actions..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      // Clear semantic search when user types
                      if (isSemanticSearch) {
                        handleClearSemanticSearch();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) {
                        handleSemanticSearch();
                      }
                    }}
                    className="pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        handleClearSemanticSearch();
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSemanticSearch}
                  disabled={!searchTerm.trim()}
                  title="Semantic Search (Shift+Enter)"
                  className={`flex-shrink-0 ${isSemanticSearch ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                >
                  <SearchCheck className="h-4 w-4" />
                </Button>
              </div>
              {isSemanticSearch && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  Showing {semanticResults.length} semantically similar actions
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-2">
                          <p className="font-semibold">Semantic search includes:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li><strong>Existing State:</strong> The initial description of what needs to be done</li>
                            <li><strong>Evidence:</strong> What was actually accomplished</li>
                            <li><strong>Policy:</strong> Lessons learned and best practices</li>
                            <li><strong>Observations:</strong> Field notes and additional context</li>
                          </ul>
                          <p className="text-sm mt-2 pt-2 border-t">
                            <strong>Tip:</strong> Search using natural language to find actions by their purpose, outcomes, or lessons learned. For example: "banana wine fermentation" or "organic pest control"
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
              )}
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
              {unresolved.map((action, index) => (
                <ActionListItemCard
                  key={action.id || `unresolved-${index}`}
                  action={action}
                  profiles={profiles}
                  onClick={handleEditAction}
                  onScoreAction={handleScoreAction}
                  getUserColor={getUserColor}
                  showScoreButton={true}
                />
              ))}
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
              {completed.map((action, index) => (
                <ActionListItemCard
                  key={action.id || `completed-${index}`}
                  action={action}
                  profiles={profiles}
                  onClick={handleEditAction}
                  onScoreAction={handleScoreAction}
                  getUserColor={getUserColor}
                  showScoreButton={true}
                />
              ))}
            </div>
          )}
         </TabsContent>
       </Tabs>

       {/* Action Dialog */}
        <UnifiedActionDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            // Let the dialog control its own close behavior
            // It will block close during uploads and call this when actually ready to close
            setIsEditDialogOpen(open);
            if (!open) {
              setEditingActionId(null);
              setIsCreating(false);
              // Navigate away if we came from a direct action link
              if (actionId) {
                navigate('/actions');
              }
            }
          }}
          actionId={editingActionId || undefined}
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