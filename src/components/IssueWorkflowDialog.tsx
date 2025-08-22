import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Stethoscope, 
  Wrench, 
  CheckCircle, 
  User, 
  Calendar,
  ClipboardCheck,
  Settings,
  AlertTriangle 
} from "lucide-react";
import { ToolIssue } from "@/hooks/useToolIssues";
import { ACTION_REQUIRED_OPTIONS } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

interface IssueWorkflowDialogProps {
  issue: ToolIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onUpdate: (issueId: string, updates: Partial<ToolIssue>) => Promise<boolean>;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  // Check user permissions
  const isToolKeeper = userRole === 'leadership';
  const isRepairer = userRole === 'leadership';

  useEffect(() => {
    if (issue) {
      setActionRequired(issue.action_required || "");
      setWorkflowStatus(issue.workflow_status || "reported");
      setResolutionNotes(issue.resolution_notes || "");
      setRootCause(issue.root_cause || "");
    }
  }, [issue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issue) return;

    setIsSubmitting(true);
    try {
      const updates: Partial<ToolIssue> = {};

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
  const canDiagnose = isToolKeeper && issue.workflow_status === 'reported';
  const canProgress = isRepairer && ['diagnosed', 'in_progress'].includes(issue.workflow_status);
  const canComplete = isRepairer && issue.workflow_status === 'in_progress';

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

          {/* Repairer Section - Execution */}
          {canProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Repair Execution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <div>
                      <Label htmlFor="rootCause">Root Cause</Label>
                      <Textarea
                        id="rootCause"
                        value={rootCause}
                        onChange={(e) => setRootCause(e.target.value)}
                        placeholder="What caused this issue?"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="resolutionNotes">Resolution Notes *</Label>
                      <Textarea
                        id="resolutionNotes"
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Describe how the issue was resolved..."
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
                  {!isToolKeeper && !isRepairer && (
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
