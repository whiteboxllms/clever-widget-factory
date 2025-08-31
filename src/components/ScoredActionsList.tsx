import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, User, Target, Star } from 'lucide-react';
import { ScoredAction } from '@/hooks/useScoredActions';

interface ScoredActionsListProps {
  scoredActions: ScoredAction[];
  isLoading: boolean;
}

export function ScoredActionsList({ scoredActions, isLoading }: ScoredActionsListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'not_started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAverageScore = (scores: Record<string, { score: number; reason: string }>) => {
    const scoreValues = Object.values(scores).map(s => s.score);
    if (scoreValues.length === 0) return 0;
    return scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scored Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scoredActions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Scored Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Scored Actions Found</h3>
            <p>No actions have been scored for the selected filters.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Scored Actions ({scoredActions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {scoredActions.map((scoredAction) => (
            <div key={scoredAction.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1">
                    {scoredAction.action?.title || 'Untitled Action'}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {scoredAction.action?.description || 'No description available'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs font-medium">
                      {getAverageScore(scoredAction.scores).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge 
                  variant="outline" 
                  className={getStatusColor(scoredAction.action?.status || 'unknown')}
                >
                  {scoredAction.action?.status || 'Unknown'}
                </Badge>
                
                {scoredAction.asset_context_name && (
                  <Badge variant="outline" className="bg-purple-100 text-purple-800">
                    {scoredAction.asset_context_name}
                  </Badge>
                )}

                {scoredAction.action?.assignee && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    <User className="h-3 w-3 mr-1" />
                    {scoredAction.action.assignee.full_name}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Scored: {formatDate(scoredAction.created_at)}
                </div>
                <div>
                  Source: {scoredAction.source_type}
                </div>
              </div>

              {scoredAction.likely_root_causes && scoredAction.likely_root_causes.length > 0 && (
                <div className="mt-3 pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Root Causes:</div>
                  <div className="flex flex-wrap gap-1">
                    {scoredAction.likely_root_causes.slice(0, 3).map((cause, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {cause}
                      </Badge>
                    ))}
                    {scoredAction.likely_root_causes.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{scoredAction.likely_root_causes.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}