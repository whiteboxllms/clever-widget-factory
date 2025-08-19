import { AlertTriangle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToolIssues } from "@/hooks/useToolIssues";

interface ToolIssuesSummaryProps {
  toolId: string;
  knownIssues?: string;
}

export function ToolIssuesSummary({ toolId, knownIssues }: ToolIssuesSummaryProps) {
  const { issues, isLoading } = useToolIssues(toolId);

  if (isLoading) {
    return null;
  }

  const efficiencyIssues = issues.filter(issue => issue.issue_type === 'efficiency');
  const safetyIssues = issues.filter(issue => issue.issue_type === 'safety');
  const otherIssues = issues.filter(issue => !['efficiency', 'safety'].includes(issue.issue_type));
  
  const hasActiveIssues = issues.length > 0;
  const hasLegacyIssues = knownIssues && knownIssues.trim().length > 0;

  if (!hasActiveIssues && !hasLegacyIssues) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Active Issues from tool_issues table */}
      {safetyIssues.length > 0 && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <Badge variant="destructive" className="text-xs">
            {safetyIssues.length} Safety Issue{safetyIssues.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}
      
      {efficiencyIssues.length > 0 && (
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-600" />
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
            {efficiencyIssues.length} Efficiency Issue{efficiencyIssues.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {otherIssues.length > 0 && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <Badge variant="outline" className="text-xs">
            {otherIssues.length} Other Issue{otherIssues.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {/* Legacy known_issues field */}
      {hasLegacyIssues && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Legacy Notes
          </Badge>
        </div>
      )}
    </div>
  );
}