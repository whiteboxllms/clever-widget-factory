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
import { Bolt, Plus, Filter, Search, Clock, CheckCircle, Circle, User, AlertTriangle, Wrench, ArrowLeft } from 'lucide-react';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { BaseAction, Profile } from '@/types/actions';
import { cn } from '@/lib/utils';
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

  const fetchActions = async () => {
    try {
      const { data, error } = await supabase
        .from('actions')
        .select(`
          *,
          assignee:profiles(id, user_id, full_name, role),
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

      setActions(data?.map(item => ({
        ...item,
        required_stock: Array.isArray(item.required_stock) ? item.required_stock : [],
        asset: toolsData.find(tool => tool.id === item.asset_id) || null,
        assignee: item.assignee && typeof item.assignee === 'object' && !('error' in item.assignee) 
          ? {
              id: item.assignee.id || '',
              user_id: item.assignee.user_id || '',
              full_name: item.assignee.full_name || '',
              role: item.assignee.role || ''
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
        .from('profiles')
        .select('*');
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleEditAction = (action: BaseAction) => {
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
               stripHtmlAndSearch(action.plan) ||
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
      return 'bg-[hsl(var(--action-ready)/0.1)] text-[hsl(var(--action-ready))] border-[hsl(var(--action-ready)/0.2)]';
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


  const unresolved = filteredActions.filter(a => a.status !== 'completed');
  const completed = filteredActions.filter(a => a.status === 'completed');
  
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
              <Input
                placeholder="Search actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
              {unresolved.map(action => (
                <Card 
                  key={action.id} 
                  className={cn(
                    "hover:shadow-md transition-shadow cursor-pointer",
                    action.plan_commitment && status !== 'completed' && "border-2 border-[hsl(var(--action-ready-border))]",
                    action.status === 'in_progress' && !action.plan_commitment && "border-2 border-[hsl(var(--action-progress-border))]",
                    action.status === 'completed' && "border-2 border-[hsl(var(--action-done-border))]"
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
                <p className="text-muted-foreground">No policy actions have been completed yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {completed.map(action => (
                <Card 
                  key={action.id} 
                  className={cn(
                    "hover:shadow-md transition-shadow cursor-pointer",
                    action.plan_commitment && action.status !== 'completed' && "border-2 border-[hsl(var(--action-ready-border))]",
                    action.status === 'in_progress' && !action.plan_commitment && "border-2 border-[hsl(var(--action-progress-border))]",
                    action.status === 'completed' && "border-2 border-[hsl(var(--action-done-border))]"
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
                          
                          {action.score && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                              Score: {action.score}
                            </Badge>
                          )}
                          
                          {action.mission && (
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                              Mission #{action.mission.mission_number}: {action.mission.title}
                            </Badge>
                          )}
                          
                          {action.assignee && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {action.assignee.full_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground text-right">
                        <div>Completed: {action.completed_at ? new Date(action.completed_at).toLocaleString() : 'N/A'}</div>
                        {action.estimated_completion_date && (
                          <div>Expected: {new Date(action.estimated_completion_date).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {isEditDialogOpen && (
        <UnifiedActionDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          action={editingAction || undefined}
          context={isCreating ? { type: 'asset' } : undefined}
          profiles={profiles}
          onActionSaved={handleSaveAction}
          isCreating={isCreating}
        />
      )}
    </div>
  );
}