import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ToolIssue {
  id: string;
  description: string;
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'maintenance';
  status: 'active' | 'resolved' | 'removed';
  reported_at: string;
  reported_by: string;
  blocks_checkout?: boolean;
  is_misuse?: boolean;
  damage_assessment?: string;
  responsibility_assigned?: boolean;
  resolution_photo_urls?: string[];
}

interface IssueCardProps {
  issue: ToolIssue;
  onResolve: (issue: ToolIssue) => void;
  onRefresh: () => void;
}

export function IssueCard({ issue, onResolve, onRefresh }: IssueCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const getIssueTypeIcon = (issueType: string) => {
    switch (issueType) {
      case 'safety':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'efficiency':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'cosmetic':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'maintenance':
        return <Clock className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType) {
      case 'safety':
        return 'destructive';
      case 'efficiency':
        return 'default';
      case 'cosmetic':
        return 'secondary';
      case 'maintenance':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handleRemove = async () => {
    setIsRemoving(true);
    
    try {
      // Update issue status to removed
      const { error: updateError } = await supabase
        .from('tool_issues')
        .update({
          status: 'removed'
        })
        .eq('id', issue.id);

      if (updateError) throw updateError;

      // Create history record
      const { error: historyError } = await supabase
        .from('tool_issue_history')
        .insert({
          issue_id: issue.id,
          old_status: issue.status,
          new_status: 'removed',
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: 'Issue removed during check-in'
        });

      if (historyError) throw historyError;

      toast({
        title: "Issue removed",
        description: "The issue has been removed from the tool."
      });

      onRefresh();

    } catch (error) {
      console.error('Error removing issue:', error);
      toast({
        title: "Error removing issue",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary/20">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {getIssueTypeIcon(issue.issue_type)}
              <Badge variant={getIssueTypeColor(issue.issue_type) as any} className="text-xs">
                {issue.issue_type}
              </Badge>
              {issue.blocks_checkout && (
                <Badge variant="destructive" className="text-xs">
                  OFFLINE
                </Badge>
              )}
              {issue.is_misuse && (
                <Badge variant="secondary" className="text-xs">
                  MISUSE
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(issue.reported_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm break-words">{issue.description}</p>
            {issue.damage_assessment && (
              <p className="text-sm text-orange-600 mt-1">
                <strong>Damage:</strong> {issue.damage_assessment}
              </p>
            )}
            {issue.resolution_photo_urls && issue.resolution_photo_urls.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Resolution Photos:</p>
                <div className="flex gap-1 flex-wrap">
                  {issue.resolution_photo_urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Resolution photo ${index + 1}`}
                      className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(issue)}
              className="h-7 px-2 text-xs"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRemove}
              disabled={isRemoving}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}