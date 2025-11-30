import { useState, useEffect, forwardRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, Edit, Plus, AlertTriangle, Clock, LogOut, LogIn, Loader2, ExternalLink, Zap, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useToolHistory, HistoryEntry, AssetHistoryEntry, CheckoutHistory, IssueHistoryEntry } from "@/hooks/tools/useToolHistory";
import { Link } from "react-router-dom";

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

export const AssetHistoryDialog = forwardRef<HTMLDivElement, AssetHistoryDialogProps>(
  ({ assetId, assetName, children }, ref) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { toolHistory, assetInfo, loading, fetchToolHistory } = useToolHistory();

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
        case 'action_created':
          return <Zap className="h-4 w-4 text-purple-600" />;
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
        case 'action_created':
          return entry.action_title || 'Action created';
        default:
          return 'Asset modified';
      }
    } else if (isCheckoutHistory(entry)) {
      return entry.is_returned ? 'Tool returned' : 'Tool checked out';
    } else if (isIssueHistory(entry)) {
      // Show status transition for issue updates
      if (entry.old_status && entry.new_status && entry.old_status !== entry.new_status) {
        return `Issue ${entry.old_status} → ${entry.new_status}`;
      }
      // For issue creation, show description if available, otherwise show type
      if (entry.issue_description) {
        return entry.issue_description.length > 100 
          ? entry.issue_description.substring(0, 100) + '...' 
          : entry.issue_description;
      }
      return entry.issue_type ? `${entry.issue_type} issue reported` : 'Issue reported';
    }
    return 'Activity recorded';
  };

  const getChangeBadge = (entry: HistoryEntry) => {
    if (isAssetHistory(entry)) {
      return entry.change_type === 'created' ? 'Created' :
             entry.change_type === 'status_change' ? 'Status Changed' :
             entry.change_type === 'action_created' ? 'Action' :
             entry.change_type === 'updated' ? 'Updated' : entry.change_type;
    } else if (isCheckoutHistory(entry)) {
      return entry.is_returned ? 'Returned' : 'Checked Out';
    } else if (isIssueHistory(entry)) {
      return entry.issue_type ? `Issue: ${entry.issue_type}` : `Issue: ${entry.new_status}`;
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
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading history...</p>
              </div>
            </div>
          ) : toolHistory.length === 0 ? (
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
                      
                      {/* Checkout context: Action link or intended usage */}
                      {isCheckoutHistory(entry) && (
                        <>
                          {/* Show action link if action_id exists */}
                          {entry.action_id && entry.action_title && (
                            <div className="text-sm bg-blue-50 border border-blue-200 p-2 rounded mt-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-blue-900">Action:</span>
                                <Link
                                  to={`/actions?action=${entry.action_id}`}
                                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {entry.action_title}
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </div>
                            </div>
                          )}
                          
                          {/* Show intended usage if no action_id but intended_usage exists */}
                          {!entry.action_id && entry.intended_usage && (
                            <div className="text-sm bg-gray-50 border border-gray-200 p-2 rounded mt-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">Intended Usage:</span>
                                <span className="text-gray-700">{entry.intended_usage}</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Show notes if present */}
                          {entry.notes && (
                            <div className="text-sm bg-muted p-2 rounded mt-2 mb-2">
                              <span className="font-medium">Notes:</span>{' '}
                              <span className="text-muted-foreground">{entry.notes}</span>
                            </div>
                          )}
                        </>
                      )}
                      
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

                      {/* Action display section */}
                      {isAssetHistory(entry) && entry.change_type === 'action_created' && (
                        <div className="text-sm bg-purple-50 border border-purple-200 p-3 rounded mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-purple-600" />
                            <span className="font-medium text-purple-900">Action Details:</span>
                            {entry.action_status && (
                              <Badge 
                                variant={entry.action_status === 'completed' ? 'default' : 'outline'} 
                                className="text-xs"
                              >
                                {entry.action_status}
                              </Badge>
                            )}
                          </div>
                          {entry.action_title && (
                            <div className="text-purple-800 mb-2">
                              <p className="font-medium mb-1">Action:</p>
                              <p>{entry.action_title}</p>
                            </div>
                          )}
                          {entry.notes && (
                            <div className="text-sm text-purple-700">
                              <p className="font-medium mb-1">Details:</p>
                              <p>{entry.notes}</p>
                            </div>
                          )}
                          {entry.action_id && (
                            <Link
                              to={`/actions?action=${entry.action_id}`}
                              className="text-purple-600 hover:text-purple-800 underline flex items-center gap-1 mt-2 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Action
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Issue display section */}
                      {isIssueHistory(entry) && (
                        <div className={`text-sm border p-3 rounded mt-2 ${
                          entry.new_status === 'resolved' 
                            ? 'bg-green-50 border-green-200' 
                            : entry.new_status === 'removed'
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <AlertTriangle className={`h-4 w-4 ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-600' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-600'
                                : 'text-red-600'
                            }`} />
                            <span className={`font-medium ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-900' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-900'
                                : 'text-red-900'
                            }`}>Issue Details:</span>
                            {entry.issue_type && (
                              <Badge variant="outline" className="text-xs">
                                {entry.issue_type}
                              </Badge>
                            )}
                            <Badge 
                              variant={
                                entry.new_status === 'resolved' 
                                  ? 'default' 
                                  : entry.new_status === 'removed'
                                  ? 'secondary'
                                  : 'destructive'
                              } 
                              className="text-xs"
                            >
                              {entry.new_status}
                            </Badge>
                          </div>
                          {entry.issue_description && (
                            <div className={`mb-2 ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-800' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-800'
                                : 'text-red-800'
                            }`}>
                              <p className="font-medium mb-1">Description:</p>
                              <p>{entry.issue_description}</p>
                            </div>
                          )}
                          {/* Show damage assessment if available */}
                          {entry.damage_assessment && (
                            <div className={`mb-2 ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-800' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-800'
                                : 'text-red-800'
                            }`}>
                              <p className="font-medium mb-1">Damage Assessment:</p>
                              <p>{entry.damage_assessment}</p>
                            </div>
                          )}
                          {entry.old_status && entry.new_status && entry.old_status !== entry.new_status && (
                            <p className={`text-sm mb-1 ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-700' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-700'
                                : 'text-red-700'
                            }`}>
                              Status changed: <span className="font-medium">{entry.old_status}</span> → <span className="font-medium">{entry.new_status}</span>
                            </p>
                          )}
                          {entry.notes && (
                            <p className={`text-sm mt-1 ${
                              entry.new_status === 'resolved' 
                                ? 'text-green-700' 
                                : entry.new_status === 'removed'
                                ? 'text-gray-700'
                                : 'text-red-700'
                            }`}>{entry.notes}</p>
                          )}
                          {entry.issue_id && (
                            <Link
                              to={`/issues?issue=${entry.issue_id}`}
                              className={`underline flex items-center gap-1 mt-2 text-sm ${
                                entry.new_status === 'resolved' 
                                  ? 'text-green-600 hover:text-green-800' 
                                  : entry.new_status === 'removed'
                                  ? 'text-gray-600 hover:text-gray-800'
                                  : 'text-red-600 hover:text-red-800'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Issue
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              
              {/* Asset Creation Info */}
              {assetInfo && (
                <Card className="p-4 bg-muted/50 border-dashed">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <Plus className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">System</span>
                          <Badge variant="outline" className="text-xs">
                            Created
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(assetInfo.created_at).toLocaleDateString()} {new Date(assetInfo.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Asset created
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

AssetHistoryDialog.displayName = "AssetHistoryDialog";
