import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Stethoscope, 
  Wrench, 
  CheckCircle, 
  User, 
  Calendar,
  ClipboardCheck,
  Settings,
  AlertTriangle,
  Brain,
  Package 
} from "lucide-react";
import { BaseIssue } from "@/types/issues";
import { ACTION_REQUIRED_OPTIONS } from "@/lib/constants";
import { useAuth } from "@/hooks/useCognitoAuth";
import { AttributeSelector } from "@/components/AttributeSelector";
import { WorkerSelector } from "@/components/WorkerSelector";
import { useIssueRequirements } from "@/hooks/useWorkerAttributes";

interface IssueWorkflowDialogProps {
  issue: BaseIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onUpdate: (issueId: string, updates: Partial<BaseIssue>) => Promise<boolean>;
  userRole?: string;
}

const workflowSteps = [
  { status: 'reported', label: 'Reported', icon: AlertTriangle, color: 'text-red-500' },
  { status: 'diagnosed', label: 'Diagnosed', icon: Stethoscope, color: 'text-blue-500' },
  { status: 'in_progress', label: 'In Progress', icon: Settings, color: 'text-orange-500' },
  { status: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' }
];

export function IssueWorkflowDialog({ 
  issue, 
  open, 
  onOpenChange, 
  onSuccess, 
  onUpdate, 
  userRole 
}: IssueWorkflowDialogProps) {
  const [actionRequired, setActionRequired] = useState<string>("");
  const [workflowStatus, setWorkflowStatus] = useState<string>("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [workProgress, setWorkProgress] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | undefined>();
  const [actualHours, setActualHours] = useState<number | undefined>();
  const [assignedWorkerId, setAssignedWorkerId] = useState<string | null>(null);
  const [canSelfClaim, setCanSelfClaim] = useState(false);
  const [readyToWork, setReadyToWork] = useState(false);
  const [nextSteps, setNextSteps] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  
  // Get issue requirements
  const { requirements, addRequirement, removeRequirement } = useIssueRequirements(issue?.id || null);

  // Check user permissions
  const canManageWorkflow = userRole === 'admin' || userRole === 'contributor';
  const canRepair = userRole === 'admin' || userRole === 'contributor';

  useEffect(() => {
    if (issue) {
      setActionRequired(issue.action_required || "");
      setWorkflowStatus(issue.workflow_status || "reported");
      setResolutionNotes(issue.resolution_notes || "");
      setRootCause(issue.root_cause || "");
      setAiAnalysis(issue.ai_analysis || "");
      setWorkProgress(issue.work_progress || "");
      setEstimatedHours(issue.estimated_hours || undefined);
      setActualHours(issue.actual_hours || undefined);
      setAssignedWorkerId(issue.assigned_to || null);
      setCanSelfClaim(issue.can_self_claim || false);
      setReadyToWork(issue.ready_to_work || false);
      setNextSteps(issue.next_steps || "");
    }
  }, [issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;

    setIsSubmitting(true);
    try {
      const updates: Partial<BaseIssue> = {};

      // Tool Keeper actions (diagnosis)
      if (workflowStatus === 'diagnosed' && !issue.diagnosed_by) {
        updates.diagnosed_by = user?.id;
        updates.diagnosed_at = new Date().toISOString();
      }

      // Update workflow status
      if (workflowStatus !== issue.workflow_status) {
        updates.workflow_status = workflowStatus as any;
      }

      // Update action required if changed
      if (actionRequired !== issue.action_required) {
        updates.action_required = actionRequired as any;
      }

      // Update additional fields
      if (aiAnalysis !== issue.ai_analysis) {
        updates.ai_analysis = aiAnalysis;
      }
      if (workProgress !== issue.work_progress) {
        updates.work_progress = workProgress;
      }
      if (estimatedHours !== issue.estimated_hours) {
        updates.estimated_hours = estimatedHours;
      }
      if (actualHours !== issue.actual_hours) {
        updates.actual_hours = actualHours;
      }
      if (assignedWorkerId !== issue.assigned_to) {
        updates.assigned_to = assignedWorkerId;
      }
      if (canSelfClaim !== issue.can_self_claim) {
        updates.can_self_claim = canSelfClaim;
      }
      if (readyToWork !== issue.ready_to_work) {
        updates.ready_to_work = readyToWork;
      }
      if (nextSteps !== issue.next_steps) {
        updates.next_steps = nextSteps;
      }

      // Update resolution info if completing
      if (workflowStatus === 'completed') {
        if (resolutionNotes !== issue.resolution_notes) {
          updates.resolution_notes = resolutionNotes;
        }
        if (rootCause !== issue.root_cause) {
          updates.root_cause = rootCause;
        }
        if (!issue.resolved_by) {
          updates.resolved_by = user?.id;
          updates.resolved_at = new Date().toISOString();
        }
      }

      await onUpdate(issue.id, updates);
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating workflow:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!issue) return null;

  const currentStepIndex = workflowSteps.findIndex(step => step.status === issue.workflow_status);
  const canDiagnose = canManageWorkflow && issue.workflow_status === 'reported';
  const canProgress = canRepair && ['diagnosed', 'in_progress'].includes(issue.workflow_status);
  const canComplete = canRepair && issue.workflow_status === 'in_progress';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Issue Workflow Management
          </DialogTitle>
        </DialogHeader>

        {/* Workflow Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {workflowSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                
                return (
                  <div key={step.status} className="flex flex-col items-center space-y-2">
                    <div className={`
                      p-2 rounded-full border-2 transition-colors
                      ${isActive 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-muted bg-muted text-muted-foreground'
                      }
                      ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                    `}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                    </div>
                    {index < workflowSteps.length - 1 && (
                      <div className={`
                        h-px w-16 
                        ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}
                      `} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Issue Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Issue Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">Description:</p>
              <p className="text-sm text-muted-foreground">{issue.description}</p>
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-sm font-medium">Type:</p>
                <Badge variant="secondary">{issue.issue_type}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Reported:</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(issue.reported_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tool Keeper Section - Diagnosis */}
          {canDiagnose && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Tool Keeper Diagnosis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="actionRequired">Action Required *</Label>
                  <Select value={actionRequired} onValueChange={setActionRequired}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action required" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_REQUIRED_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimatedHours">Estimated Hours</Label>
                    <Select 
                      value={estimatedHours?.toString() || ''} 
                      onValueChange={(value) => setEstimatedHours(value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select hours" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.5, 1, 2, 4, 8, 16, 24, 40].map((hours) => (
                          <SelectItem key={hours} value={hours.toString()}>
                            {hours} {hours === 1 ? 'hour' : 'hours'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="aiAnalysis">AI Analysis & Recommendations</Label>
                  <Textarea
                    id="aiAnalysis"
                    value={aiAnalysis}
                    onChange={(e) => setAiAnalysis(e.target.value)}
                    placeholder="AI-generated analysis, recommendations, or notes..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="nextSteps">Tool Keeper Next Steps</Label>
                  <Textarea
                    id="nextSteps"
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    placeholder="Comments about next steps, follow-up actions, or tool keeper notes..."
                    rows={3}
                  />
                </div>

                <Separator />

                {/* Skill Requirements */}
                <AttributeSelector
                  requirements={requirements}
                  onAddRequirement={addRequirement}
                  onRemoveRequirement={removeRequirement}
                  disabled={workflowStatus !== 'reported'}
                />

                <Separator />

                {/* Worker Assignment */}
                <WorkerSelector
                  requirements={requirements}
                  selectedWorkerId={assignedWorkerId}
                  onWorkerSelect={setAssignedWorkerId}
                  canSelfClaim={canSelfClaim}
                  onCanSelfClaimChange={setCanSelfClaim}
                  disabled={workflowStatus !== 'reported'}
                />
                
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setWorkflowStatus('diagnosed')}
                    disabled={!actionRequired}
                  >
                    <Stethoscope className="h-4 w-4 mr-2" />
                    Complete Diagnosis
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Worker Section - Execution */}
          {canProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Work Progress & Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ready to Work Toggle */}
                {issue.workflow_status === 'diagnosed' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="readyToWork"
                      checked={readyToWork}
                      onChange={(e) => setReadyToWork(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="readyToWork">
                      Materials Available & Ready to Start Work
                    </Label>
                  </div>
                )}

                <div>
                  <Label htmlFor="workProgress">Work Progress & Notes</Label>
                  <Textarea
                    id="workProgress"
                    value={workProgress}
                    onChange={(e) => setWorkProgress(e.target.value)}
                    placeholder="Document your progress, materials used, challenges encountered..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="actualHours">Actual Hours Worked</Label>
                    <Select 
                      value={actualHours?.toString() || ''} 
                      onValueChange={(value) => setActualHours(value ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select hours" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.5, 1, 2, 4, 8, 16, 24, 40].map((hours) => (
                          <SelectItem key={hours} value={hours.toString()}>
                            {hours} {hours === 1 ? 'hour' : 'hours'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="workflowStatus">Update Status</Label>
                  <Select value={workflowStatus} onValueChange={setWorkflowStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {issue.workflow_status === 'diagnosed' && (
                        <SelectItem value="in_progress">Start Repair</SelectItem>
                      )}
                      {issue.workflow_status === 'in_progress' && (
                        <SelectItem value="completed">Complete Repair</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {workflowStatus === 'completed' && (
                  <>
                    <Separator />
                    <div>
                      <Label htmlFor="rootCause">Root Cause Analysis</Label>
                      <Textarea
                        id="rootCause"
                        value={rootCause}
                        onChange={(e) => setRootCause(e.target.value)}
                        placeholder="What caused this issue? How can it be prevented?"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="resolutionNotes">Resolution Summary *</Label>
                      <Textarea
                        id="resolutionNotes"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Describe how the issue was resolved, parts used, final outcome..."
                        rows={3}
                        required
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Status Display */}
          {!canDiagnose && !canProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Workflow Status:</span> 
                    <Badge variant="secondary" className="ml-2">
                      {workflowSteps.find(step => step.status === issue.workflow_status)?.label}
                    </Badge>
                  </p>
                  {issue.action_required && (
                    <p className="text-sm">
                      <span className="font-medium">Action Required:</span> 
                      <Badge variant="outline" className="ml-2">
                        {ACTION_REQUIRED_OPTIONS.find(opt => opt.value === issue.action_required)?.label}
                      </Badge>
                    </p>
                  )}
                  {!canManageWorkflow && !canRepair && (
                    <p className="text-sm text-muted-foreground">
                      You don't have permission to modify this workflow.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {(canDiagnose || canProgress) && (
              <Button
                type="submit"
                disabled={isSubmitting || (workflowStatus === 'completed' && !resolutionNotes.trim())}
              >
                {isSubmitting ? "Updating..." : "Update Workflow"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
