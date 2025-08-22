import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  TrendingUp,
  Award,
  User,
  Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ToolIssue } from '@/hooks/useToolIssues';
import { IssueWorkflowDialog } from '@/components/IssueWorkflowDialog';
import { useWorkerAttributes, WorkerAttribute, IssueRequirement, AttributeType } from '@/hooks/useWorkerAttributes';

interface IssueWithTool extends ToolIssue {
  tool_name: string;
  tool_location: string;
  requirements?: IssueRequirement[];
  canClaim?: boolean;
}

const attributeLabels: Record<AttributeType, string> = {
  communication: 'Communication',
  quality: 'Quality',
  transparency: 'Transparency', 
  reliability: 'Reliability',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  it: 'IT',
  carpentry: 'Carpentry',
  plumbing: 'Plumbing',
  hydraulics: 'Hydraulics',
  welding: 'Welding',
  fabrication: 'Fabrication'
};

export default function Worker() {
  const [assignedIssues, setAssignedIssues] = useState<IssueWithTool[]>([]);
  const [availableIssues, setAvailableIssues] = useState<IssueWithTool[]>([]);
  const [myAttributes, setMyAttributes] = useState<WorkerAttribute[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<ToolIssue | null>(null);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user } = useAuth();
  const { checkQualification, getWorkerQualifications } = useWorkerAttributes();

  useEffect(() => {
    if (user?.id) {
      fetchMyIssues();
      fetchAvailableIssues();
      fetchMyAttributes();
    }
  }, [user?.id]);

  const fetchMyIssues = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('tool_issues')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('status', 'active')
        .order('reported_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setAssignedIssues([]);
        return;
      }

      // Get unique tool IDs
      const toolIds = [...new Set(data.map(issue => issue.tool_id))];
      
      // Fetch tool information separately
      const { data: toolsData, error: toolsError } = await supabase
        .from('tools')
        .select('id, name, storage_vicinity, storage_location')
        .in('id', toolIds);

      if (toolsError) throw toolsError;

      // Create tool lookup map
      const toolsMap = new Map();
      (toolsData || []).forEach(tool => {
        toolsMap.set(tool.id, tool);
      });

      const issuesWithRequirements = await Promise.all(
        data.map(async (issue) => {
          const { data: requirements } = await supabase
            .from('issue_requirements')
            .select('*')
            .eq('issue_id', issue.id);

          const tool = toolsMap.get(issue.tool_id);

          return {
            ...issue,
            tool_name: tool?.name || 'Unknown Tool',
            tool_location: `${tool?.storage_vicinity || ''} ${tool?.storage_location || ''}`.trim() || 'Unknown Location',
            requirements: requirements || []
          };
        })
      );

      setAssignedIssues(issuesWithRequirements as IssueWithTool[]);
    } catch (error) {
      console.error('Error fetching assigned issues:', error);
    }
  };

  const fetchAvailableIssues = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('tool_issues')
        .select('*')
        .eq('can_self_claim', true)
        .eq('workflow_status', 'diagnosed')
        .eq('status', 'active')
        .is('assigned_to', null)
        .order('reported_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        setAvailableIssues([]);
        return;
      }

      // Get unique tool IDs
      const toolIds = [...new Set(data.map(issue => issue.tool_id))];
      
      // Fetch tool information separately
      const { data: toolsData, error: toolsError } = await supabase
        .from('tools')
        .select('id, name, storage_vicinity, storage_location')
        .in('id', toolIds);

      if (toolsError) throw toolsError;

      // Create tool lookup map
      const toolsMap = new Map();
      (toolsData || []).forEach(tool => {
        toolsMap.set(tool.id, tool);
      });

      const issuesWithRequirements = await Promise.all(
        data.map(async (issue) => {
          const { data: requirements } = await supabase
            .from('issue_requirements')
            .select('*')
            .eq('issue_id', issue.id);

          const tool = toolsMap.get(issue.tool_id);

          return {
            ...issue,
            tool_name: tool?.name || 'Unknown Tool',
            tool_location: `${tool?.storage_vicinity || ''} ${tool?.storage_location || ''}`.trim() || 'Unknown Location',
            requirements: requirements || [],
            canClaim: checkQualification(user.id, requirements || [])
          };
        })
      );

      setAvailableIssues(issuesWithRequirements as IssueWithTool[]);
    } catch (error) {
      console.error('Error fetching available issues:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyAttributes = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('worker_attributes')
        .select('*')
        .eq('user_id', user.id)
        .order('attribute_type');

      if (error) throw error;
      setMyAttributes(data || []);
    } catch (error) {
      console.error('Error fetching attributes:', error);
    }
  };

  const handleClaimIssue = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('tool_issues')
        .update({ 
          assigned_to: user?.id,
          can_self_claim: false 
        })
        .eq('id', issueId);

      if (error) throw error;

      await fetchMyIssues();
      await fetchAvailableIssues();
    } catch (error) {
      console.error('Error claiming issue:', error);
    }
  };

  const handleIssueUpdate = async (issueId: string, updates: Partial<ToolIssue>) => {
    try {
      const { error } = await supabase
        .from('tool_issues')
        .update(updates)
        .eq('id', issueId);

      if (error) throw error;

      await fetchMyIssues();
      await fetchAvailableIssues();
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

  const getAttributeLevel = (attributeType: AttributeType): number => {
    const attr = myAttributes.find(a => a.attribute_type === attributeType);
    return attr?.level || 0;
  };

  const getQualificationBadge = (requirements: IssueRequirement[]) => {
    if (requirements.length === 0) {
      return <Badge variant="outline" className="text-green-600">No Requirements</Badge>;
    }

    const qualified = checkQualification(user?.id || '', requirements);
    return qualified 
      ? <Badge variant="outline" className="text-green-600">Qualified</Badge>
      : <Badge variant="outline" className="text-red-600">Not Qualified</Badge>;
  };

  const getMySkillsProgress = () => {
    const maxLevel = 5;
    const totalPossibleLevels = Object.keys(attributeLabels).length * maxLevel;
    const currentLevels = myAttributes.reduce((sum, attr) => sum + attr.level, 0);
    return Math.round((currentLevels / totalPossibleLevels) * 100);
  };

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
          <h1 className="text-3xl font-bold">Worker Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your assignments and claim new work
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{assignedIssues.length} Active Assignments</Badge>
          <Badge variant="outline">{availableIssues.filter(i => i.canClaim).length} Available Claims</Badge>
        </div>
      </div>

      {/* Skills Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4" />
            My Skills & Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span>{getMySkillsProgress()}%</span>
                </div>
                <Progress value={getMySkillsProgress()} className="h-2" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{myAttributes.reduce((sum, attr) => sum + attr.level, 0)}</div>
                <div className="text-xs text-muted-foreground">Total Levels</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(attributeLabels).map(([key, label]) => {
                const level = getAttributeLevel(key as AttributeType);
                return (
                  <div key={key} className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-lg font-bold">{level}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Management Tabs */}
      <Tabs defaultValue="assigned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="assigned">My Assignments ({assignedIssues.length})</TabsTrigger>
          <TabsTrigger value="available">Available Work ({availableIssues.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assigned" className="space-y-4">
          {assignedIssues.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Active Assignments</h3>
                <p className="text-muted-foreground">
                  Check the Available Work tab to claim new issues that match your skills.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assignedIssues.map((issue) => (
                <Card key={issue.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{issue.tool_name}</CardTitle>
                      <Badge variant={issue.workflow_status === 'in_progress' ? 'default' : 'secondary'}>
                        {issue.workflow_status === 'diagnosed' ? 'Ready to Start' : 
                         issue.workflow_status === 'in_progress' ? 'In Progress' : issue.workflow_status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{issue.tool_location}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{issue.description}</p>
                      
                      {issue.requirements && issue.requirements.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium">Required Skills:</div>
                          <div className="flex flex-wrap gap-1">
                            {issue.requirements.map((req) => (
                              <Badge 
                                key={req.id} 
                                variant="outline" 
                                className={`text-xs ${
                                  getAttributeLevel(req.attribute_type) >= req.required_level 
                                    ? 'text-green-600' 
                                    : 'text-red-600'
                                }`}
                              >
                                {attributeLabels[req.attribute_type]} L{req.required_level}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {issue.estimated_hours && (
                        <div className="text-xs text-muted-foreground">
                          Estimated: {issue.estimated_hours} hours
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => openWorkflowDialog(issue)}
                          className="flex-1"
                        >
                          <Wrench className="h-4 w-4 mr-2" />
                          Manage Work
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {availableIssues.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No Available Work</h3>
                <p className="text-muted-foreground">
                  There are currently no issues available for claiming. Check back later!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {availableIssues.map((issue) => (
                <Card key={issue.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{issue.tool_name}</CardTitle>
                      {getQualificationBadge(issue.requirements || [])}
                    </div>
                    <div className="text-sm text-muted-foreground">{issue.tool_location}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{issue.description}</p>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{issue.issue_type}</Badge>
                        {issue.estimated_hours && (
                          <span className="text-xs text-muted-foreground">
                            Est: {issue.estimated_hours}h
                          </span>
                        )}
                      </div>

                      {issue.requirements && issue.requirements.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-medium">Required Skills:</div>
                          <div className="flex flex-wrap gap-1">
                            {issue.requirements.map((req) => (
                              <Badge 
                                key={req.id} 
                                variant="outline" 
                                className={`text-xs ${
                                  getAttributeLevel(req.attribute_type) >= req.required_level 
                                    ? 'text-green-600' 
                                    : 'text-red-600'
                                }`}
                              >
                                {attributeLabels[req.attribute_type]} L{req.required_level}
                                {getAttributeLevel(req.attribute_type) >= req.required_level && ' ✓'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleClaimIssue(issue.id)}
                          disabled={!issue.canClaim}
                          className="flex-1"
                        >
                          {issue.canClaim ? (
                            <>
                              <User className="h-4 w-4 mr-2" />
                              Claim This Work
                            </>
                          ) : (
                            'Not Qualified'
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Issue Workflow Dialog */}
      <IssueWorkflowDialog
        issue={selectedIssue}
        open={isWorkflowDialogOpen}
        onOpenChange={setIsWorkflowDialogOpen}
        onUpdate={handleIssueUpdate}
        userRole="worker"
        onSuccess={() => {
          fetchMyIssues();
          fetchAvailableIssues();
          setIsWorkflowDialogOpen(false);
        }}
      />
    </div>
  );
}