import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Brain, CheckCircle2, Clock, X, Plus, Eye } from 'lucide-react';
import { listSessions, type FiveWhysSession } from '@/services/fiveWhysService';
import { BaseIssue } from '@/types/issues';
import { format } from 'date-fns';

interface FiveWhysSessionSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issue: BaseIssue;
  organizationId: string;
  currentUserId: string;
  onViewSession: (sessionId: string) => void;
  onCreateNew: () => void;
  onContinueSession: (sessionId: string) => void;
}

export function FiveWhysSessionSelector({
  open,
  onOpenChange,
  issue,
  organizationId,
  currentUserId,
  onViewSession,
  onCreateNew,
  onContinueSession
}: FiveWhysSessionSelectorProps) {
  const [sessions, setSessions] = useState<FiveWhysSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open, issue.id, organizationId]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listSessions(issue.id, organizationId);
      if (result.success && result.data) {
        setSessions(result.data.sessions);
      } else {
        setError(result.error || 'Failed to load sessions');
        setSessions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'abandoned':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case 'abandoned':
        return <Badge variant="outline">Abandoned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            5 Whys Analysis Sessions
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
            Error: {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No analysis sessions found for this issue.</p>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Start New Analysis
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                New Analysis
              </Button>
            </div>

            {sessions.map((session) => {
              const isOwnSession = session.created_by === currentUserId;
              const canContinue = isOwnSession && session.status === 'in_progress';

              return (
                <Card key={session.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(session.status)}
                        <CardTitle className="text-base">
                          {session.creator_name || 'Unknown'}
                        </CardTitle>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(session.updated_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <div>Created: {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}</div>
                        {session.message_count !== undefined && (
                          <div>{session.message_count} messages</div>
                        )}
                        {session.root_cause_analysis && (
                          <div className="mt-1 text-xs text-green-600">Root cause identified</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewSession(session.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        {canContinue && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => onContinueSession(session.id)}
                          >
                            Continue
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

