import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkerAttributes, AttributeType, IssueRequirement } from '@/hooks/useWorkerAttributes';

interface WorkerProfile {
  user_id: string;
  full_name: string;
  role: string;
}

interface WorkerSelectorProps {
  requirements: IssueRequirement[];
  selectedWorkerId?: string;
  onWorkerSelect: (workerId: string | null) => void;
  canSelfClaim: boolean;
  onCanSelfClaimChange: (canSelfClaim: boolean) => void;
  disabled?: boolean;
}

export function WorkerSelector({ 
  requirements, 
  selectedWorkerId, 
  onWorkerSelect, 
  canSelfClaim, 
  onCanSelfClaimChange,
  disabled 
}: WorkerSelectorProps) {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [currentWorkloads, setCurrentWorkloads] = useState<Record<string, number>>({});
  const { getWorkerQualifications, checkQualification } = useWorkerAttributes();

  useEffect(() => {
    fetchWorkers();
    fetchWorkloads();
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .not('full_name', 'is', null);

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const fetchWorkloads = async () => {
    try {
      const { data, error } = await supabase
        .from('tool_issues')
        .select('assigned_to')
        .eq('status', 'active')
        .in('workflow_status', ['diagnosed', 'in_progress']);

      if (error) throw error;

      const workloads: Record<string, number> = {};
      data?.forEach(issue => {
        if (issue.assigned_to) {
          workloads[issue.assigned_to] = (workloads[issue.assigned_to] || 0) + 1;
        }
      });

      setCurrentWorkloads(workloads);
    } catch (error) {
      console.error('Error fetching workloads:', error);
    }
  };

  const getWorkerStatus = (workerId: string) => {
    const qualified = checkQualification(workerId, requirements);
    const workload = currentWorkloads[workerId] || 0;
    
    if (!qualified) return { status: 'unqualified', icon: XCircle, color: 'text-red-500' };
    if (workload === 0) return { status: 'available', icon: CheckCircle, color: 'text-green-500' };
    if (workload <= 2) return { status: 'busy', icon: Clock, color: 'text-yellow-500' };
    return { status: 'overloaded', icon: XCircle, color: 'text-red-500' };
  };

  const getSortedWorkers = () => {
    return workers
      .map(worker => ({
        ...worker,
        ...getWorkerStatus(worker.user_id),
        qualifications: getWorkerQualifications(worker.user_id),
        workload: currentWorkloads[worker.user_id] || 0
      }))
      .sort((a, b) => {
        // Sort by qualification first, then by workload
        if (a.status === 'available' && b.status !== 'available') return -1;
        if (b.status === 'available' && a.status !== 'available') return 1;
        if (a.status === 'busy' && b.status === 'overloaded') return -1;
        if (b.status === 'busy' && a.status === 'overloaded') return 1;
        return a.workload - b.workload;
      });
  };

  const sortedWorkers = getSortedWorkers();
  const qualifiedWorkers = sortedWorkers.filter(w => w.status !== 'unqualified');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Worker Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assignment Options */}
        <div className="flex gap-2">
          <Badge 
            variant={!canSelfClaim && selectedWorkerId ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => !disabled && onCanSelfClaimChange(false)}
          >
            Direct Assignment
          </Badge>
          <Badge 
            variant={canSelfClaim ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => !disabled && onCanSelfClaimChange(true)}
          >
            Open for Claims
          </Badge>
        </div>

        {/* Worker Selection */}
        {!canSelfClaim && (
          <div>
            <Select 
              value={selectedWorkerId || ''} 
              onValueChange={(value) => onWorkerSelect(value || null)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Unassigned</SelectItem>
                {sortedWorkers.map((worker) => {
                  const StatusIcon = worker.icon;
                  return (
                    <SelectItem 
                      key={worker.user_id} 
                      value={worker.user_id}
                      disabled={worker.status === 'unqualified'}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {worker.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1">{worker.full_name}</span>
                        <StatusIcon className={`h-4 w-4 ${worker.color}`} />
                        {worker.workload > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {worker.workload}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Qualification Summary */}
        {requirements.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Qualified Workers:</div>
            <div className="text-sm">
              {qualifiedWorkers.length === 0 ? (
                <span className="text-red-500">No qualified workers available</span>
              ) : (
                <span className="text-green-600">
                  {qualifiedWorkers.length} qualified worker{qualifiedWorkers.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>
            {qualifiedWorkers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {qualifiedWorkers.slice(0, 3).map((worker) => (
                  <Badge key={worker.user_id} variant="outline" className="text-xs">
                    {worker.full_name}
                  </Badge>
                ))}
                {qualifiedWorkers.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{qualifiedWorkers.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}