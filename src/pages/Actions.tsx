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
import { POLICY_CATEGORY_OPTIONS } from '@/lib/constants';
import { Target, Plus, Filter, Search, Clock, CheckCircle, Circle, User, AlertTriangle } from 'lucide-react';

interface PolicyAction {
  id: string;
  title: string;
  description?: string;
  status: string;
  policy_category?: string;
  asset_id?: string;
  mission_id?: string;
  assigned_to?: string;
  linked_issue_id?: string;
  score?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  asset?: { name: string; category: string; } | null;
  assignee?: { full_name: string; } | null;
  mission?: { title: string; mission_number: number; } | null;
  issue_tool?: { name: string; category: string; } | null;
}

export default function Actions() {
  const { user } = useAuth();
  const [actions, setActions] = useState<PolicyAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<PolicyAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const fetchActions = async () => {
    try {
      const { data, error } = await supabase
        .from('mission_actions')
        .select(`
          *,
          asset:tools(name, category),
          assignee:profiles!mission_actions_assigned_to_fkey(full_name),
          mission:missions(title, mission_number),
          issue_tool:tool_issues!mission_actions_linked_issue_id_fkey(
            tool_id,
            tool:tools(name, category)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActions((data as any[])?.map(item => ({
        ...item,
        asset: item.asset && typeof item.asset === 'object' && !('error' in item.asset) ? item.asset : null,
        assignee: item.assignee && typeof item.assignee === 'object' && !('error' in item.assignee) ? item.assignee : null,
        mission: item.mission && typeof item.mission === 'object' && !('error' in item.mission) ? item.mission : null,
        issue_tool: item.issue_tool?.tool && typeof item.issue_tool.tool === 'object' && !('error' in item.issue_tool.tool) ? item.issue_tool.tool : null
      })) || []);
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

  useEffect(() => {
    fetchActions();
  }, []);

  useEffect(() => {
    let filtered = actions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(action =>
        action.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        action.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(action => action.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(action => action.policy_category === categoryFilter);
    }

    // Assignee filter
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        filtered = filtered.filter(action => !action.assigned_to);
      } else if (assigneeFilter === 'me' && user) {
        filtered = filtered.filter(action => action.assigned_to === user.id);
      }
    }

    setFilteredActions(filtered);
  }, [actions, searchTerm, statusFilter, categoryFilter, assigneeFilter, user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPolicyCategoryColor = (category?: string) => {
    switch (category) {
      case 'experiment':
        return 'bg-purple-100 text-purple-800';
      case 'legal':
        return 'bg-red-100 text-red-800';
      case 'product_development':
        return 'bg-green-100 text-green-800';
      case 'training':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unresolved = filteredActions.filter(a => a.status !== 'completed');
  const completed = filteredActions.filter(a => a.status === 'completed');

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
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Policy Actions</h1>
            <p className="text-muted-foreground">Track and manage RL-aligned policy actions</p>
          </div>
        </div>
        <Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="text-sm font-medium">Policy Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {POLICY_CATEGORY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No unresolved actions</h3>
                <p className="text-muted-foreground">All policy actions are completed or none match your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {unresolved.map(action => (
                <Card key={action.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(action.status)}
                          <h3 className="text-lg font-semibold">{action.title}</h3>
                        </div>
                        
                        {action.description && (
                          <p className="text-muted-foreground">{action.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getStatusColor(action.status)}>
                            {action.status.replace('_', ' ')}
                          </Badge>
                          
                          {action.policy_category && (
                            <Badge variant="outline" className={getPolicyCategoryColor(action.policy_category)}>
                              {POLICY_CATEGORY_OPTIONS.find(opt => opt.value === action.policy_category)?.label}
                            </Badge>
                          )}
                          
                          {action.asset && (
                            <Badge variant="outline">
                              Asset: {action.asset.name}
                            </Badge>
                          )}
                          
                          {!action.asset && action.issue_tool && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">
                              Issue Tool: {action.issue_tool.name}
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
                        <div>Created: {new Date(action.created_at).toLocaleDateString()}</div>
                        <div>Updated: {new Date(action.updated_at).toLocaleDateString()}</div>
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
                <Card key={action.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(action.status)}
                          <h3 className="text-lg font-semibold">{action.title}</h3>
                        </div>
                        
                        {action.description && (
                          <p className="text-muted-foreground">{action.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          <Badge className={getStatusColor(action.status)}>
                            {action.status.replace('_', ' ')}
                          </Badge>
                          
                          {action.policy_category && (
                            <Badge variant="outline" className={getPolicyCategoryColor(action.policy_category)}>
                              {POLICY_CATEGORY_OPTIONS.find(opt => opt.value === action.policy_category)?.label}
                            </Badge>
                          )}
                          
                          {action.score && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                              Score: {action.score}
                            </Badge>
                          )}
                          
                          {action.asset && (
                            <Badge variant="outline">
                              Asset: {action.asset.name}
                            </Badge>
                          )}
                          
                          {!action.asset && action.issue_tool && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">
                              Issue Tool: {action.issue_tool.name}
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
                        <div>Completed: {action.completed_at ? new Date(action.completed_at).toLocaleDateString() : 'N/A'}</div>
                        <div>Created: {new Date(action.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}