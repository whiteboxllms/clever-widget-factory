import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, TrendingUp, TrendingDown, Edit, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface HistoryEntry {
  id: string;
  change_type: string;
  old_quantity: number | null;
  new_quantity: number | null;
  quantity_change: number | null;
  changed_by: string;
  change_reason: string | null;
  changed_at: string;
  mission_id?: string; // For mission usage entries
  usage_description?: string; // For mission usage entries
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

      // Fetch from mission_inventory_usage table
      const { data: missionUsage, error: missionError } = await supabase
        .from('mission_inventory_usage')
        .select(`
          *,
          missions(mission_number, title)
        `)
        .eq('part_id', partId)
        .order('created_at', { ascending: false });

      if (missionError) throw missionError;

      // Convert mission usage to history entry format
      const missionHistoryEntries: HistoryEntry[] = (missionUsage || []).map(usage => ({
        id: usage.id,
        change_type: 'mission_usage',
        old_quantity: null,
        new_quantity: null,
        quantity_change: -usage.quantity_used,
        changed_by: usage.usage_description?.includes('User') ? 'Mission User' : 'Mission Team',
        change_reason: `Used for Mission ${(usage.missions as any)?.mission_number ? 
          `#${(usage.missions as any).mission_number}` : ''}: ${usage.usage_description}`,
        changed_at: usage.created_at,
        mission_id: usage.mission_id,
        usage_description: usage.usage_description
      }));

      // Combine and sort all history entries
      const allHistory = [
        ...(partsHistory || []),
        ...missionHistoryEntries
      ].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

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
      case 'update':
        return 'Updated item details';
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
      case 'update':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Updated</Badge>;
      case 'create':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Created</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
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
            <div className="space-y-4">
              {history.map((entry) => (
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
                            By {entry.changed_by} • {format(new Date(entry.changed_at), 'PPpp')}
                          </div>
                          {entry.change_reason && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Reason: {entry.change_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}