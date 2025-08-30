import { AlertTriangle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToolIssues } from "@/hooks/useToolIssues";

interface ToolIssuesSummaryProps {
  toolId: string;
}

export function ToolIssuesSummary({ toolId }: ToolIssuesSummaryProps) {
  const { issues, isLoading } = useToolIssues(toolId);

  if (isLoading) {
    return null;
  }

  const hasActiveIssues = issues.length > 0;

  if (!hasActiveIssues) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <Badge variant="outline" className="text-xs">
          {issues.length} Issue{issues.length !== 1 ? 's' : ''} Reported
        </Badge>
      </div>
    </div>
  );
}