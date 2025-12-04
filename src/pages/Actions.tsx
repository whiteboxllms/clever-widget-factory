import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/hooks/useCognitoAuth";
import { toast } from '@/hooks/use-toast';
import { useOrganizationMembers } from '@/hooks/useOrganizationMembers';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { Bolt, Plus, Filter, Search, CheckCircle, AlertTriangle, ArrowLeft, X } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ActionScoreDialog } from '@/components/ActionScoreDialog';
import { ActionListItemCard } from '@/components/ActionListItemCard';
import { useActionScores, ActionScore } from '@/hooks/useActionScores';
import { BaseAction, Profile } from '@/types/actions';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiService } from '@/lib/apiService';
import { actionsQueryKey } from '@/lib/queryKeys';

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

  // Use shared query key to share cache with other parts of the app (like useEnhancedStrategicAttributes)
  // This prevents duplicate queries and uses the default 15 minute staleTime from offlineQueryConfig
  const { data: actions = [], isLoading: loading } = useQuery({
    queryKey: actionsQueryKey(),
    queryFn: fetchActions,
    ...offlineQueryConfig,
  });

  const fetchSpecificAction = useCallback(async (id: string) => {
    if (!organizationId) return;
    
    try {
      const action = actions.find((a: any) => a.id === id);
      
      if (!action) {
        throw new Error('Action not found');
      }

      setEditingActionId(id);
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
  }, [organizationId, navigate, actions]);

  // Profiles are now handled by useActionProfiles hook for consistency

  const handleEditAction = async (action: BaseAction) => {
    setEditingActionId(action.id);
    setIsCreating(false);
    setIsEditDialogOpen(true);
  };

  const queryClient = useQueryClient();
  
  const handleSaveAction = async () => {
    queryClient.invalidateQueries({ queryKey: ['actions'] });
    setIsEditDialogOpen(false);
    setEditingActionId(null);
    setIsCreating(false);
  };

  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingActionId(null);
    setIsCreating(false);
  };

  const handleCreateAction = () => {
    setEditingActionId(null);
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
        setEditingActionId(searchActionId);
        setIsEditDialogOpen(true);
        setIsCreating(false);
        processedUrlRef.current = searchActionId;
        // Clear the URL parameter after opening the action
        setSearchParams({});
      }
    } else if (urlActionId && organizationId && actions.length > 0) {
      // Find the action in the current actions list
      const action = actions.find(a => a.id === urlActionId);
      if (action) {
        setEditingActionId(urlActionId);
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
              {unresolved.map(action => (
                <ActionListItemCard
                  key={action.id}
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
              {completed.map(action => (
                <ActionListItemCard
                  key={action.id}
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
            if (!open) {
              // Don't navigate if we're in the middle of an upload
              // Check if there's an active upload by checking the dialog's isUploading state
              // We'll handle navigation after upload completes or fails
              handleCancelEdit();
              // Clear URL parameter when dialog is closed
              // Only navigate if we're not in the middle of an upload
              // The dialog component will handle preventing close during upload
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