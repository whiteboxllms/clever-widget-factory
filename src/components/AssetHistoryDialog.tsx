import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Edit, Plus, AlertTriangle, Clock, LogOut, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory, HistoryEntry, AssetHistoryEntry, CheckoutHistory, IssueHistoryEntry } from "@/hooks/tools/useToolHistory";

// Type guard functions
const isAssetHistory = (entry: HistoryEntry): entry is AssetHistoryEntry => {
  return 'change_type' in entry && 'changed_at' in entry && 'changed_by' in entry;
};

const isCheckoutHistory = (entry: HistoryEntry): entry is CheckoutHistory => {
  return 'checkout_date' in entry && 'is_returned' in entry;
};

const isIssueHistory = (entry: HistoryEntry): entry is IssueHistoryEntry => {
  return 'issue_id' in entry && 'old_status' in entry && 'new_status' in entry;
};

interface AssetHistoryDialogProps {
  assetId: string;
  assetName: string;
  children: React.ReactNode;
}

export function AssetHistoryDialog({ assetId, assetName, children }: AssetHistoryDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { toolHistory, fetchToolHistory } = useToolHistory();

  useEffect(() => {
    if (open) {
      fetchToolHistory(assetId);
    }
  }, [open, assetId, fetchToolHistory]);

  const getChangeIcon = (entry: HistoryEntry) => {
    if (isAssetHistory(entry)) {
      switch (entry.change_type) {
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
    } else if (isCheckoutHistory(entry)) {
      return entry.is_returned ? <LogIn className="h-4 w-4 text-green-600" /> : <LogOut className="h-4 w-4 text-blue-600" />;
    } else if (isIssueHistory(entry)) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <History className="h-4 w-4 text-gray-600" />;
  };

  const getChangeDescription = (entry: HistoryEntry) => {
    if (isAssetHistory(entry)) {
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
    } else if (isCheckoutHistory(entry)) {
      return entry.is_returned ? 'Tool returned' : 'Tool checked out';
    } else if (isIssueHistory(entry)) {
      return `Issue ${entry.new_status}`;
    }
    return 'Activity recorded';
  };

  const getChangeBadge = (entry: HistoryEntry) => {
    if (isAssetHistory(entry)) {
      return entry.change_type === 'created' ? 'Created' :
             entry.change_type === 'status_change' ? 'Status Changed' :
             entry.change_type === 'updated' ? 'Updated' : entry.change_type;
    } else if (isCheckoutHistory(entry)) {
      return entry.is_returned ? 'Returned' : 'Checked Out';
    } else if (isIssueHistory(entry)) {
      return `Issue ${entry.new_status}`;
    }
    return 'Activity';
  };

  const getChangeDate = (entry: HistoryEntry) => {
    if (isCheckoutHistory(entry)) {
      return entry.checkout_date || entry.created_at;
    }
    return entry.changed_at;
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
          {toolHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No history records found for this asset.
            </div>
          ) : (
            <div className="space-y-4">
              {toolHistory.map((entry) => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getChangeIcon(entry)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.user_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {getChangeBadge(entry)}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(getChangeDate(entry)).toLocaleDateString()} {new Date(getChangeDate(entry)).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {getChangeDescription(entry)}
                      </p>
                      
                      {isAssetHistory(entry) && entry.field_changed && entry.old_value !== undefined && entry.new_value !== undefined && (
                        <div className="text-sm bg-muted p-2 rounded">
                          <span className="font-medium">{entry.field_changed}:</span>{' '}
                          <span className="text-muted-foreground">{entry.old_value || '(empty)'}</span>
                          {' → '}
                          <span className="text-muted-foreground">{entry.new_value || '(empty)'}</span>
                        </div>
                      )}
                      
                      {isAssetHistory(entry) && entry.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {entry.notes}
                        </p>
                      )}

                      {isCheckoutHistory(entry) && entry.checkin && (
                        <div className="text-sm bg-muted p-2 rounded mt-2">
                          <p><span className="font-medium">Hours used:</span> {entry.checkin.hours_used || 'N/A'}</p>
                          {entry.checkin.problems_reported && (
                            <p><span className="font-medium">Problems reported:</span> {entry.checkin.problems_reported}</p>
                          )}
                          {entry.checkin.notes && (
                            <p><span className="font-medium">Notes:</span> {entry.checkin.notes}</p>
                          )}
                        </div>
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
