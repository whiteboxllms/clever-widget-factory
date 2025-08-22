import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Stethoscope,
  User,
  Search,
  Filter,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ToolIssue } from '@/hooks/useToolIssues';
import { IssueWorkflowDialog } from '@/components/IssueWorkflowDialog';
import { useWorkerAttributes, IssueRequirement } from '@/hooks/useWorkerAttributes';

interface IssueWithTool extends ToolIssue {
  tool_name: string;
  tool_location: string;
  requirements?: IssueRequirement[];
  tools?: { name: string; storage_vicinity: string; storage_location: string };
}

export default function ToolKeeper() {
  const [issues, setIssues] = useState<IssueWithTool[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<IssueWithTool[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState<ToolIssue | null>(null);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user, isLeadership } = useAuth();
  const { updateAttributeLevel } = useWorkerAttributes();

  useEffect(() => {
    if (!isLeadership) {
      // Redirect non-leadership users
      window.location.href = '/tools';
      return;
    }
    fetchIssues();
  }, [isLeadership]);

  useEffect(() => {
    filterIssues();
  }, [issues, searchTerm, statusFilter, typeFilter, assignmentFilter]);

  const fetchIssues = async () => {
    try {
      setIsLoading(true);
      
      // Fetch issues with tool information
      const { data: issuesData, error: issuesError } = await supabase
        .from('tool_issues')
        .select(`
          *,
          tools!tool_issues_tool_id_fkey (
            name,
            storage_vicinity,
            storage_location
          )
        `)
        .eq('status', 'active')
        .order('reported_at', { ascending: false });

      if (issuesError) throw issuesError;

      // Fetch requirements for each issue
      const issuesWithRequirements = await Promise.all(
        (issuesData || []).map(async (issue) => {
          const { data: requirements } = await supabase
            .from('issue_requirements')
            .select('*')
            .eq('issue_id', issue.id);

          return {
            ...issue,
            tool_name: issue.tools?.name || 'Unknown Tool',
            tool_location: `${issue.tools?.storage_vicinity || ''} ${issue.tools?.storage_location || ''}`.trim(),
            requirements: requirements || []
          };
        })
      );

      setIssues(issuesWithRequirements as IssueWithTool[]);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterIssues = () => {
    let filtered = issues;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(issue => 
        issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.tool_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(issue => issue.workflow_status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(issue => issue.issue_type === typeFilter);
    }

    // Assignment filter
    if (assignmentFilter !== 'all') {
      if (assignmentFilter === 'unassigned') {
        filtered = filtered.filter(issue => !issue.assigned_to && !issue.can_self_claim);
      } else if (assignmentFilter === 'assigned') {
        filtered = filtered.filter(issue => issue.assigned_to);
      } else if (assignmentFilter === 'claimable') {
        filtered = filtered.filter(issue => issue.can_self_claim);
      }
    }

    setFilteredIssues(filtered);
  };

  const handleIssueUpdate = async (issueId: string, updates: Partial<ToolIssue>) => {
    try {
      const { error } = await supabase
        .from('tool_issues')
        .update(updates)
        .eq('id', issueId);

      if (error) throw error;

      // If completing an issue, potentially update worker levels
      if (updates.workflow_status === 'completed' && updates.assigned_to) {
        const issue = issues.find(i => i.id === issueId);
        if (issue?.requirements) {
          // Increment relevant attribute levels for successful completion
          for (const req of issue.requirements) {
            await updateAttributeLevel(updates.assigned_to, req.attribute_type, req.required_level + 1);
          }
        }
      }

      await fetchIssues();
      return true;
    } catch (error) {
      console.error('Error updating issue:', error);
      return false;
    }
  };

  const openWorkflowDialog = (issue: IssueWithTool) => {
    setSelectedIssue(issue);
    setIsWorkflowDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'reported':
        return <Badge variant="destructive">Needs Diagnosis</Badge>;
      case 'diagnosed':
        return <Badge variant="secondary">Ready for Assignment</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAssignmentStatus = (issue: IssueWithTool) => {
    if (issue.assigned_to) {
      return <Badge variant="outline" className="text-blue-600">Assigned</Badge>;
    }
    if (issue.can_self_claim) {
      return <Badge variant="outline" className="text-green-600">Open for Claims</Badge>;
    }
    return <Badge variant="outline" className="text-gray-600">Unassigned</Badge>;
  };

  const getPriorityColor = (issue: IssueWithTool) => {
    if (issue.issue_type === 'safety') return 'border-l-red-500';
    if (issue.issue_type === 'efficiency') return 'border-l-orange-500';
    return 'border-l-gray-300';
  };

  const getIssuesByStatus = (status: string) => {
    return filteredIssues.filter(issue => issue.workflow_status === status);
  };

  if (!isLeadership) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tool Keeper Dashboard</h1>
          <p className="text-muted-foreground">
            Manage tool issues, diagnose problems, and assign work
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filteredIssues.length} Total Issues</Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="reported">Needs Diagnosis</SelectItem>
                <SelectItem value="diagnosed">Ready for Assignment</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="efficiency">Efficiency</SelectItem>
                <SelectItem value="cosmetic">Cosmetic</SelectItem>
                <SelectItem value="functionality">Functionality</SelectItem>
                <SelectItem value="preventative_maintenance">Preventative</SelectItem>
                <SelectItem value="lifespan">Lifespan</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignments</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="claimable">Open for Claims</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={fetchIssues} variant="outline">
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issue Management Tabs */}
      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Kanban View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Reported Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Needs Diagnosis ({getIssuesByStatus('reported').length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getIssuesByStatus('reported').map((issue) => (
                  <Card 
                    key={issue.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(issue)}`}
                    onClick={() => openWorkflowDialog(issue)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{issue.tool_name}</div>
                        <div className="text-xs text-muted-foreground">{issue.tool_location}</div>
                        <div className="text-sm">{issue.description.substring(0, 80)}...</div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {issue.issue_type}
                          </Badge>
                          {getAssignmentStatus(issue)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Diagnosed Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-blue-500" />
                  Ready for Work ({getIssuesByStatus('diagnosed').length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getIssuesByStatus('diagnosed').map((issue) => (
                  <Card 
                    key={issue.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(issue)}`}
                    onClick={() => openWorkflowDialog(issue)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{issue.tool_name}</div>
                        <div className="text-xs text-muted-foreground">{issue.tool_location}</div>
                        <div className="text-sm">{issue.description.substring(0, 80)}...</div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {issue.issue_type}
                          </Badge>
                          {getAssignmentStatus(issue)}
                        </div>
                        {issue.requirements && issue.requirements.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Skills: {issue.requirements.map(r => `${r.attribute_type} L${r.required_level}`).join(', ')}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* In Progress Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  In Progress ({getIssuesByStatus('in_progress').length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getIssuesByStatus('in_progress').map((issue) => (
                  <Card 
                    key={issue.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(issue)}`}
                    onClick={() => openWorkflowDialog(issue)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{issue.tool_name}</div>
                        <div className="text-xs text-muted-foreground">{issue.tool_location}</div>
                        <div className="text-sm">{issue.description.substring(0, 80)}...</div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {issue.issue_type}
                          </Badge>
                          {getAssignmentStatus(issue)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            {/* Completed Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Completed ({getIssuesByStatus('completed').length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getIssuesByStatus('completed').map((issue) => (
                  <Card 
                    key={issue.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(issue)}`}
                    onClick={() => openWorkflowDialog(issue)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">{issue.tool_name}</div>
                        <div className="text-xs text-muted-foreground">{issue.tool_location}</div>
                        <div className="text-sm">{issue.description.substring(0, 80)}...</div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {issue.issue_type}
                          </Badge>
                          {getAssignmentStatus(issue)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="space-y-2">
                {filteredIssues.map((issue) => (
                  <div 
                    key={issue.id}
                    className={`p-4 border-b hover:bg-muted/50 cursor-pointer border-l-4 ${getPriorityColor(issue)}`}
                    onClick={() => openWorkflowDialog(issue)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{issue.tool_name} - {issue.tool_location}</div>
                        <div className="text-sm text-muted-foreground">{issue.description}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{issue.issue_type}</Badge>
                          {getStatusBadge(issue.workflow_status)}
                          {getAssignmentStatus(issue)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {new Date(issue.reported_at).toLocaleDateString()}
                        </div>
                        {issue.estimated_hours && (
                          <div className="text-xs text-muted-foreground">
                            Est: {issue.estimated_hours}h
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Issue Workflow Dialog */}
      <IssueWorkflowDialog
        issue={selectedIssue}
        open={isWorkflowDialogOpen}
        onOpenChange={setIsWorkflowDialogOpen}
        onUpdate={handleIssueUpdate}
        userRole="leadership"
        onSuccess={() => {
          fetchIssues();
          setIsWorkflowDialogOpen(false);
        }}
      />
    </div>
  );
}