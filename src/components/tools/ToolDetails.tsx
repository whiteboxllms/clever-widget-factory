import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tool } from "@/hooks/tools/useToolsData";
import { CheckoutHistory, HistoryEntry, IssueHistoryEntry } from "@/hooks/tools/useToolHistory";
import { ToolStatusBadge } from "./ToolStatusBadge";


import { AlertTriangle, Bug, Shield, Wrench, Clock } from "lucide-react";
import { getIssueTypeIconName } from "@/lib/issueTypeUtils";

interface ToolDetailsProps {
  tool: Tool;
  toolHistory: HistoryEntry[];
  currentCheckout: { user_name: string } | null;
  onBack: () => void;
}

export const ToolDetails = ({
  tool,
  toolHistory,
  currentCheckout,
  onBack
}: ToolDetailsProps) => {
  const isCheckoutHistory = (record: HistoryEntry): record is CheckoutHistory => {
    return record.type !== 'issue_change';
  };

  const isIssueHistory = (record: HistoryEntry): record is IssueHistoryEntry => {
    return record.type === 'issue_change';
  };

  // Issue type utilities imported from centralized location

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'created': return 'Issue Reported';
      case 'updated': return 'Issue Updated';
      case 'resolved': return 'Issue Resolved';
      case 'removed': return 'Issue Removed';
      default: return 'Issue Changed';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tools
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tool.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <ToolStatusBadge status={tool.status} />
            {currentCheckout && (
              <Badge variant="secondary">
                Checked out by: {currentCheckout.user_name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tool Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="font-medium">Category:</span> {tool.category || 'Uncategorized'}
                  </div>
                  <div>
                    <span className="font-medium">Description:</span> {tool.description || 'No description'}
                  </div>
                  <div>
                    <span className="font-medium">Serial Number:</span> {tool.serial_number || 'Not specified'}
                  </div>
                  <div>
                    <span className="font-medium">Legacy Location:</span> {tool.legacy_storage_vicinity}
                  </div>
                  {tool.storage_location && (
                    <div>
                      <span className="font-medium">Storage Location:</span> {tool.storage_location}
                    </div>
                  )}
                  {tool.actual_location && (
                    <div>
                      <span className="font-medium">Actual Location:</span> {tool.actual_location}
                    </div>
                  )}
                  {tool.last_maintenance && (
                    <div>
                      <span className="font-medium">Last Maintenance:</span> {tool.last_maintenance}
                    </div>
                  )}
                  {tool.manual_url && (
                    <div>
                      <span className="font-medium">Manual:</span>{' '}
                      <a 
                        href={tool.manual_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Manual
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>



            <TabsContent value="history" className="space-y-4">
              <div className="space-y-4">
                {toolHistory.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      {isCheckoutHistory(record) ? (
                        // Checkout/Check-in History
                        <>
                          <div className="mb-2">
                            <div>
                              <p className="font-medium">{record.user_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {record.type === 'checkin' ? 'Check-in' : 'Checkout'} on{' '}
                                {(() => {
                                  const dateToUse = record.type === 'checkin' && record.checkin?.checkin_date 
                                    ? record.checkin.checkin_date 
                                    : (record.checkout_date || record.created_at);
                                  return new Date(dateToUse).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) + ' at ' + new Date(dateToUse).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  });
                                })()}
                              </p>
                            </div>
                          </div>
                          
                          {record.intended_usage && (
                            <p className="text-sm mb-2">
                              <span className="font-medium">Intended Usage:</span>{' '}
                              {record.action_id ? (
                                <a 
                                  href={`/actions?action=${record.action_id}`}
                                  className="text-blue-600 hover:text-blue-800 underline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {record.intended_usage}
                                </a>
                              ) : (
                                record.intended_usage
                              )}
                            </p>
                          )}
                          
                          {/* Notes removed from checkout display per new guidance */}

                          {record.checkin && (
                            <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                              <p className="font-medium mb-1">Check-in Details:</p>
                              {/* Combined: Check-in timestamp and duration */}
                              {record.checkin.checkin_date && (
                                <p className="mb-1">
                                  <span className="font-medium">Check In at:</span>{' '}
                                  {(() => {
                                    const end = new Date(record.checkin!.checkin_date);
                                    const tsStr = end.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }) + ' at ' + end.toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                    if (!record.checkout_date) return tsStr;
                                    const start = new Date(record.checkout_date as string);
                                    const ms = Math.max(0, end.getTime() - start.getTime());
                                    const minutes = Math.floor(ms / 60000);
                                    const days = Math.floor(minutes / (60 * 24));
                                    const hours = Math.floor((minutes % (60 * 24)) / 60);
                                    const mins = minutes % 60;
                                    const parts: string[] = [];
                                    if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
                                    if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
                                    if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
                                    const duration = parts.join(', ');
                                    return duration ? `${tsStr} after ${duration}` : tsStr;
                                  })()}
                                </p>
                              )}
                              {record.checkin.checkin_reason && (
                                <p className="mb-1">
                                  <span className="font-medium">Reason:</span> {record.checkin.checkin_reason}
                                </p>
                              )}
                              {record.checkin.problems_reported && (
                                <p className="mb-1">
                                  <span className="font-medium">Problems:</span> {record.checkin.problems_reported}
                                </p>
                              )}
                              {record.checkin.hours_used && (
                                <p className="mb-1">
                                  <span className="font-medium">Hours Used:</span> {record.checkin.hours_used}
                                </p>
                              )}
                              {record.checkin.what_did_you_do && (
                                <p className="mb-1">
                                  <span className="font-medium">Work Done:</span> {record.checkin.what_did_you_do}
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      ) : isIssueHistory(record) ? (
                        // Issue History
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-start gap-2">
                              {(() => {
                                const iconName = getIssueTypeIconName(record.issue_type || 'maintenance', 'tool');
                                const IconComponent = iconName === 'AlertTriangle' ? AlertTriangle : 
                                                      iconName === 'Clock' ? Clock : AlertTriangle;
                                return <IconComponent className="h-4 w-4 mt-0.5 text-muted-foreground" />;
                              })()}
                              <div>
                                <p className="font-medium">{record.user_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(record.changed_at).toLocaleDateString()} {new Date(record.changed_at).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {record.issue_type?.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          {record.issue_description && (
                            <p className="text-sm mb-2">
                              <span className="font-medium">Issue:</span> {record.issue_description}
                            </p>
                          )}
                          
                          {record.field_changed && (
                            <p className="text-sm mb-2">
                              <span className="font-medium">Field Changed:</span> {record.field_changed}
                              {record.old_value && record.new_value && (
                                <span className="text-muted-foreground">
                                  {' '}({record.old_value} → {record.new_value})
                                </span>
                              )}
                            </p>
                          )}
                          
                          {record.notes && (
                            <p className="text-sm text-muted-foreground">
                              {record.notes}
                            </p>
                          )}
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
                
                {toolHistory.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No history available.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {tool.image_url && (
            <Card>
              <CardContent className="p-4">
                <img
                  src={tool.image_url}
                  alt={tool.name}
                  className="w-full h-64 object-cover rounded-md"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};