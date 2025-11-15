import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, TrendingUp, TrendingDown, Edit, Plus, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface HistoryEntry {
  id: string;
  change_type: string;
  old_quantity: number | null;
  new_quantity: number | null;
  quantity_change: number | null;
  changed_by: string;
  changed_by_name?: string;
  change_reason: string | null;
  changed_at: string;
  mission_id?: string;
  mission_number?: number;
  mission_title?: string;
  usage_description?: string;
}

interface InventoryHistoryDialogProps {
  partId: string;
  partName: string;
  children: React.ReactNode;
}

export function InventoryHistoryDialog({ partId, partName, children }: InventoryHistoryDialogProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchHistory = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      // Fetch from parts_history table
      const { data: partsHistory, error: partsError } = await supabase
        .from('parts_history')
        .select('*')
        .eq('part_id', partId)
        .order('changed_at', { ascending: false });

      if (partsError) throw partsError;

      // Note: inventory_usage table doesn't exist - all usage is tracked in parts_history

      // Get unique user IDs from parts history
      const userIds = new Set<string>();
      partsHistory?.forEach(entry => {
        if (entry.changed_by) userIds.add(entry.changed_by);
      });

      // Fetch user names from organization_members (same approach as other components)
      const userMap: Record<string, string> = {};
      if (userIds.size > 0) {
        try {
          const { data: members, error: membersError } = await supabase
            .from('organization_members')
            .select('user_id, full_name')
            .in('user_id', Array.from(userIds))
            .eq('is_active', true);
          
          if (membersError) {
            console.error('Error fetching organization members:', membersError);
          } else {
            (members || []).forEach(member => {
              userMap[member.user_id] = member.full_name || 'Unknown User';
            });
          }
        } catch (error) {
          console.error('Error fetching user names:', error);
        }
      }

      // Add user names to parts history entries
      const partsHistoryWithNames: HistoryEntry[] = (partsHistory || []).map(entry => ({
        ...entry,
        changed_by_name: userMap[entry.changed_by] || 'Unknown User'
      }));

      // Sort all history entries by date
      const allHistory = partsHistoryWithNames.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

      setHistory(allHistory);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [open]);

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'quantity_add':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'quantity_remove':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'mission_usage':
        return <TrendingDown className="h-4 w-4 text-orange-600" />;
      case 'manual_usage':
        return <TrendingDown className="h-4 w-4 text-purple-600" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      default:
        return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  const getChangeDescription = (entry: HistoryEntry) => {
    switch (entry.change_type) {
      case 'quantity_add':
        return `Added ${entry.quantity_change} items (${entry.old_quantity} → ${entry.new_quantity})`;
      case 'quantity_remove':
        return `Removed ${Math.abs(entry.quantity_change!)} items (${entry.old_quantity} → ${entry.new_quantity})`;
      case 'mission_usage':
        return `Used ${Math.abs(entry.quantity_change!)} items for mission`;
      case 'manual_usage':
        return `Used ${Math.abs(entry.quantity_change!)} items (manual usage)`;
      case 'update':
        return entry.change_reason || 'Updated item details';
      case 'create':
        return 'Created item';
      default:
        return 'Unknown change';
    }
  };

  const getChangeBadge = (changeType: string) => {
    switch (changeType) {
      case 'quantity_add':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Added</Badge>;
      case 'quantity_remove':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">Removed</Badge>;
      case 'mission_usage':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Mission Usage</Badge>;
      case 'manual_usage':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Manual Usage</Badge>;
      case 'update':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'create':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Created</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const navigateToMission = (missionId: string) => {
    window.open(`/missions#${missionId}`, '_blank');
  };

  // Group history by usage type for better organization
  const usageEntries = history.filter(entry => entry.change_type === 'mission_usage' || entry.change_type === 'manual_usage');
  const otherEntries = history.filter(entry => entry.change_type !== 'mission_usage' && entry.change_type !== 'manual_usage');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History - {partName}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-96 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history records found for this item.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Usage History Summary */}
              {usageEntries.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      {usageEntries.length}
                    </Badge>
                    Usage History
                  </h3>
                  <div className="space-y-3">
                    {usageEntries.map((entry) => (
                      <Card key={entry.id} className="p-4 border-l-4 border-l-orange-400">
                        <CardContent className="p-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {getChangeIcon(entry.change_type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {getChangeBadge(entry.change_type)}
                                  <span className="text-sm font-medium">
                                    {getChangeDescription(entry)}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground mb-2">
                                  {format(new Date(entry.changed_at), 'PPpp')}
                                </div>
                                {entry.mission_id && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => navigateToMission(entry.mission_id!)}
                                      className="h-8 text-xs"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Mission #{entry.mission_number}: {entry.mission_title}
                                    </Button>
                                  </div>
                                )}
                                {entry.usage_description && (
                                  <div className="text-sm text-muted-foreground mt-1 italic">
                                    "{entry.usage_description}"
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Other History */}
              {otherEntries.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {otherEntries.length}
                    </Badge>
                    Inventory Changes
                  </h3>
                  <div className="space-y-3">
                    {otherEntries.map((entry) => (
                      <Card key={entry.id} className="p-4">
                        <CardContent className="p-0">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {getChangeIcon(entry.change_type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {getChangeBadge(entry.change_type)}
                                  <span className="text-sm font-medium">
                                    {getChangeDescription(entry)}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  By {entry.changed_by_name || 'Unknown User'} • {format(new Date(entry.changed_at), 'PPpp')}
                                </div>
                                {entry.change_reason && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {entry.change_type === 'update' ? (
                                      <div>
                                        <div className="font-medium mb-1">Changes:</div>
                                        <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                                          {entry.change_reason}
                                        </div>
                                      </div>
                                    ) : (
                                      <div>Reason: {entry.change_reason}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
