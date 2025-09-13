import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Bolt, Plus, Filter, Search, Clock, CheckCircle, Circle, User, AlertTriangle, Wrench, ArrowLeft, Target, X } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ActionScoreDialog } from '@/components/ActionScoreDialog';
import { ScoreButton } from '@/components/ScoreButton';
import { useActionScores } from '@/hooks/useActionScores';
import { BaseAction, Profile } from '@/types/actions';
import { cn, hasActualContent, getActionBorderStyle } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Using unified BaseAction interface from types/actions.ts

export default function Actions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [actions, setActions] = useState<BaseAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<BaseAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [editingAction, setEditingAction] = useState<BaseAction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [scoringAction, setScoringAction] = useState<BaseAction | null>(null);
  const [existingScore, setExistingScore] = useState<any>(null);

  const { getScoreForAction } = useActionScores();

  const fetchActions = async () => {
    try {
      const { data, error } = await supabase
        .from('actions')
        .select(`
          *,
          assignee:organization_members(id, user_id, full_name, role),
          mission:missions(id, title, mission_number, status)
        `)
        .order('created_at', { ascending: false });

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
          // Use secure function instead of direct table access
          const { data: participants } = await supabase
            .rpc('get_user_display_names');
          
          // Filter to only requested participants and add required fields
          participantsData = (participants || [])
            .filter(p => uniqueParticipantIds.includes(p.user_id))
            .map(p => ({
              id: p.user_id,
              user_id: p.user_id,
              full_name: p.full_name,
              role: '' // Role info is no longer accessible for security
            }));
        }
      }

      setActions(data?.map(item => ({
        ...item,
        required_stock: Array.isArray(item.required_stock) ? item.required_stock : [],
        participants_details: item.participants?.map(participantId => 
          participantsData.find(p => p.user_id === participantId)
        ).filter(Boolean) || [],
        asset: toolsData.find(tool => tool.id === item.asset_id) || null,
        assignee: item.assignee && typeof item.assignee === 'object' && !Array.isArray(item.assignee) && !('error' in item.assignee) 
          ? {
              id: (item.assignee as any)?.id || '',
              user_id: (item.assignee as any)?.user_id || '',
              full_name: (item.assignee as any)?.full_name || '',
              role: (item.assignee as any)?.role || ''
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
      })) as unknown as BaseAction[] || []);
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

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, full_name, role, super_admin, created_at');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleEditAction = (action: BaseAction) => {
    console.log('Actions page: Clicking action with ID:', action.id, 'and policy:', action.policy);
    setEditingAction(action);
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
    fetchProfiles();
  }, []);

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

  const getStatusIcon = (status: string, action?: BaseAction) => {
    // Blue: Ready to work (when plan_commitment is true)
    if (action?.plan_commitment && status !== 'completed') {
      return <CheckCircle className="h-4 w-4 text-[hsl(var(--action-ready))]" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-[hsl(var(--action-done))]" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-[hsl(var(--action-progress))]" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string, action?: BaseAction) => {
    // Blue: Ready to work (when plan_commitment is true)
    if (action?.plan_commitment && status !== 'completed') {
      return 'bg-background text-[hsl(var(--action-ready))] border-[hsl(var(--action-ready)/0.2)]';
    }
    
    switch (status) {
      case 'completed':
        return 'bg-[hsl(var(--action-done)/0.1)] text-[hsl(var(--action-done))] border-[hsl(var(--action-done)/0.2)]';
      case 'in_progress':
        return 'bg-[hsl(var(--action-progress)/0.1)] text-[hsl(var(--action-progress))] border-[hsl(var(--action-progress)/0.2)]';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Sort actions: in-progress first, then actions with implementation, then others
  const sortedFilteredActions = [...filteredActions].sort((a, b) => {
    // First priority: in-progress status
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    
    // Second priority: actions with implementation text (observations field)
    const aHasImplementation = a.observations && a.observations.trim().length > 0;
    const bHasImplementation = b.observations && b.observations.trim().length > 0;
    
    if (aHasImplementation && !bHasImplementation) return -1;
    if (bHasImplementation && !aHasImplementation) return 1;
    
    return 0;
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
  
  // Get unique assignees from actions
  const uniqueAssignees = Array.from(
    new Map(
      actions
        .filter(action => action.assignee?.full_name && action.assigned_to)
        .map(action => [action.assigned_to, { user_id: action.assigned_to, full_name: action.assignee!.full_name }])
    ).values()
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading actions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Bolt className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Actions</h1>
            <p className="text-muted-foreground">Track and manage actions</p>
          </div>
        </div>
        <Button onClick={handleCreateAction}>
          <Plus className="h-4 w-4 mr-2" />
          New Action
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
                  {uniqueAssignees.map(assignee => (
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
                      "hover:shadow-md transition-shadow cursor-pointer",
                      borderStyle.borderColor,
                      borderStyle.bgColor,
                      borderStyle.textColor
                    )}
                    onClick={() => handleEditAction(action)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(action.status, action)}
                            <h3 className="text-lg font-semibold">{action.title}</h3>
                          </div>
                          
                          {action.description && (
                            <p className="text-muted-foreground">{action.description}</p>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={getStatusColor(action.status, action)}>
                              {action.plan_commitment && action.status !== 'completed' ? 'Ready to Work' : 
                               action.status === 'completed' ? 'Done' :
                               action.status === 'in_progress' ? 'In Progress' :
                               action.status.replace('_', ' ')}
                            </Badge>
                            
                            {/* Action Type Indicator */}
                            {action.asset ? (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                                Asset: {action.asset.name}
                              </Badge>
                            ) : action.issue_tool ? (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800">
                                Issue Tool: {action.issue_tool.name}
                              </Badge>
                            ) : action.mission ? (
                              <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                                Mission Action
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-100 text-gray-800">
                                General Action
                              </Badge>
                            )}
                            
                            {action.mission && (
                              <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                                Mission #{action.mission.mission_number}: {action.mission.title}
                              </Badge>
                            )}
                            
                            {action.assignee ? (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {action.assignee.full_name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600">
                                Unassigned
                              </Badge>
                            )}
                            
                            {action.participants_details && action.participants_details.length > 0 && (
                              action.participants_details.map(participant => (
                                <Badge key={participant.user_id} variant="secondary" className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {participant.full_name}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground text-right">
                          {action.estimated_completion_date && (
                            <div>Expected: {new Date(action.estimated_completion_date).toLocaleDateString()}</div>
                          )}
                          <div>Updated: {new Date(action.updated_at).toLocaleString()}</div>
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
                  className="hover:shadow-md transition-shadow cursor-pointer border-2 border-[hsl(var(--action-done-border))]"
                  onClick={() => handleEditAction(action)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(action.status, action)}
                          <h3 className="text-lg font-semibold">{action.title}</h3>
                        </div>
                        
                        {action.description && (
                          <p className="text-muted-foreground">{action.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className={getStatusColor(action.status, action)}>
                            Done
                          </Badge>
                          
                          {/* Action Type Indicator */}
                          {action.asset ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              Asset: {action.asset.name}
                            </Badge>
                          ) : action.issue_tool ? (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">
                              Issue Tool: {action.issue_tool.name}
                            </Badge>
                          ) : action.mission ? (
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                              Mission Action
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-100 text-gray-800">
                              General Action
                            </Badge>
                          )}
                          
                          {action.mission && (
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                              Mission #{action.mission.mission_number}: {action.mission.title}
                            </Badge>
                          )}
                          
                           {action.assignee ? (
                             <Badge variant="outline" className="flex items-center gap-1">
                               <User className="h-3 w-3" />
                               {action.assignee.full_name}
                             </Badge>
                           ) : (
                             <Badge variant="outline" className="text-orange-600">
                               Unassigned
                             </Badge>
                           )}
                           
                           {action.participants_details && action.participants_details.length > 0 && (
                             action.participants_details.map(participant => (
                               <Badge key={participant.user_id} variant="secondary" className="flex items-center gap-1">
                                 <User className="h-3 w-3" />
                                 {participant.full_name}
                               </Badge>
                             ))
                           )}
                        </div>
                       </div>
                       
                        <div className="flex items-center gap-2">
                          <ScoreButton action={action} onScoreAction={handleScoreAction} />
                         
                         <div className="text-sm text-muted-foreground text-right">
                           {action.completed_at && (
                             <div>Completed: {new Date(action.completed_at).toLocaleDateString()}</div>
                           )}
                           <div>Updated: {new Date(action.updated_at).toLocaleString()}</div>
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