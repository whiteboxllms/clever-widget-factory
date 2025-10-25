import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Edit, Plus, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AssetHistoryEntry {
  id: string;
  change_type: 'created' | 'updated' | 'removed' | 'status_change';
  changed_at: string;
  changed_by: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  notes?: string;
  user_name?: string;
}

interface AssetHistoryDialogProps {
  assetId: string;
  assetName: string;
  children: React.ReactNode;
}

export function AssetHistoryDialog({ assetId, assetName, children }: AssetHistoryDialogProps) {
  const [history, setHistory] = useState<AssetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchHistory = async () => {
    if (!open) return;
    
    setLoading(true);
    try {
      // Fetch from asset_history table
      const { data: assetHistory, error: assetError } = await supabase
        .from('asset_history')
        .select('*')
        .eq('asset_id', assetId)
        .order('changed_at', { ascending: false });

      if (assetError) throw assetError;

      // Get unique user IDs from asset history
      const userIds = new Set<string>();
      assetHistory?.forEach(entry => {
        if (entry.changed_by) userIds.add(entry.changed_by);
      });

      // Fetch user names from organization_members
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

      // Add user names to asset history entries
      const assetHistoryWithNames: AssetHistoryEntry[] = (assetHistory || []).map(entry => ({
        ...entry,
        user_name: userMap[entry.changed_by] || 'Unknown User'
      }));

      setHistory(assetHistoryWithNames);
    } catch (error) {
      console.error('Error fetching asset history:', error);
      toast({
        title: "Error",
        description: "Failed to fetch asset history",
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
      case 'created':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'status_change':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'removed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <History className="h-4 w-4 text-gray-600" />;
    }
  };

  const getChangeDescription = (entry: AssetHistoryEntry) => {
    switch (entry.change_type) {
      case 'created':
        return 'Asset created';
      case 'updated':
        return entry.field_changed ? `Updated ${entry.field_changed}` : 'Asset updated';
      case 'status_change':
        return `Status changed from ${entry.old_value || 'unknown'} to ${entry.new_value || 'unknown'}`;
      case 'removed':
        return 'Asset removed';
      default:
        return 'Asset modified';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Asset History - {assetName}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-96 pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history records found for this asset.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getChangeIcon(entry.change_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.user_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {entry.change_type === 'created' ? 'Created' :
                             entry.change_type === 'status_change' ? 'Status Changed' :
                             entry.change_type === 'updated' ? 'Updated' : entry.change_type}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.changed_at).toLocaleDateString()} {new Date(entry.changed_at).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {getChangeDescription(entry)}
                      </p>
                      
                      {entry.field_changed && entry.old_value !== undefined && entry.new_value !== undefined && (
                        <div className="text-sm bg-muted p-2 rounded">
                          <span className="font-medium">{entry.field_changed}:</span>{' '}
                          <span className="text-muted-foreground">{entry.old_value || '(empty)'}</span>
                          {' → '}
                          <span className="text-muted-foreground">{entry.new_value || '(empty)'}</span>
                        </div>
                      )}
                      
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
