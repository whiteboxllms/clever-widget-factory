import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bug, Wrench, Shield, CheckCircle } from "lucide-react";
import { Tool } from "@/hooks/tools/useToolsData";
import { useToolIssues } from "@/hooks/useToolIssues";
import { ToolIssuesSummary } from "./ToolIssuesSummary";

interface IssueReportDialogProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const issueTypeIcons = {
  safety: Shield,
  efficiency: Wrench,
  cosmetic: Bug,
  maintenance: AlertTriangle
};

const issueTypeColors = {
  safety: "bg-destructive text-destructive-foreground",
  efficiency: "bg-orange-500 text-white",
  cosmetic: "bg-blue-500 text-blue-foreground",
  maintenance: "bg-yellow-500 text-yellow-foreground"
};

export function IssueReportDialog({ tool, open, onOpenChange, onSuccess }: IssueReportDialogProps) {
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState<"safety" | "efficiency" | "cosmetic" | "maintenance">("efficiency");
  const [blocksCheckout, setBlocksCheckout] = useState(false);
  const [damageAssessment, setDamageAssessment] = useState("");
  const [efficiencyLoss, setEfficiencyLoss] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { issues, isLoading, createIssue, fetchIssues } = useToolIssues(tool?.id || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !tool) return;

    setIsSubmitting(true);
    try {
      await createIssue(
        description,
        issueType,
        blocksCheckout,
        false, // is_misuse
        undefined, // related_checkout_id
        damageAssessment || undefined,
        efficiencyLoss ? parseFloat(efficiencyLoss) : undefined
      );

      // Reset form
      setDescription("");
      setIssueType("efficiency");
      setBlocksCheckout(false);
      setDamageAssessment("");
      setEfficiencyLoss("");
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error reporting issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    // This would trigger the existing issue resolution flow
    // For now, we'll just refresh the issues
    await fetchIssues();
  };

  if (!tool) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Report Issue - {tool.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Issues Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading existing issues...</p>
              ) : issues.length > 0 ? (
                <div className="space-y-3">
                  {issues.map((issue) => {
                    const IconComponent = issueTypeIcons[issue.issue_type];
                    return (
                      <div key={issue.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className={issueTypeColors[issue.issue_type]}>
                              {issue.issue_type}
                            </Badge>
                            {issue.blocks_checkout && (
                              <Badge variant="destructive" className="text-xs">
                                Blocks Checkout
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{issue.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Reported {new Date(issue.reported_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  No active issues reported
                </div>
              )}
              
              {/* Legacy issues from known_issues field */}
              {tool.known_issues && tool.known_issues.trim() && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Legacy Notes:</p>
                  <p className="text-sm text-muted-foreground bg-yellow-50 p-2 rounded">
                    {tool.known_issues}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Report New Issue Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Report New Issue</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="issueType">Issue Type *</Label>
                  <Select value={issueType} onValueChange={(value: any) => setIssueType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safety">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          Safety Issue
                        </div>
                      </SelectItem>
                      <SelectItem value="efficiency">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-orange-500" />
                          Efficiency/Performance
                        </div>
                      </SelectItem>
                      <SelectItem value="cosmetic">
                        <div className="flex items-center gap-2">
                          <Bug className="h-4 w-4 text-blue-500" />
                          Cosmetic
                        </div>
                      </SelectItem>
                      <SelectItem value="maintenance">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Maintenance Required
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Issue Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue in detail..."
                    rows={3}
                    required
                  />
                </div>

                {issueType === "efficiency" && (
                  <div>
                    <Label htmlFor="efficiencyLoss">Efficiency Loss % (optional)</Label>
                    <Input
                      id="efficiencyLoss"
                      type="number"
                      min="0"
                      max="100"
                      value={efficiencyLoss}
                      onChange={(e) => setEfficiencyLoss(e.target.value)}
                      placeholder="e.g., 25"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="damageAssessment">Damage Assessment (optional)</Label>
                  <Textarea
                    id="damageAssessment"
                    value={damageAssessment}
                    onChange={(e) => setDamageAssessment(e.target.value)}
                    placeholder="Describe any visible damage..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="blocksCheckout"
                    checked={blocksCheckout}
                    onCheckedChange={(checked) => setBlocksCheckout(checked === true)}
                  />
                  <Label htmlFor="blocksCheckout" className="text-sm">
                    This issue should prevent the asset from being checked out
                  </Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!description.trim() || isSubmitting}
                  >
                    {isSubmitting ? "Reporting..." : "Report Issue"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
