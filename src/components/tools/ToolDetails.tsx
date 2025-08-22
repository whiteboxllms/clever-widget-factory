import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tool } from "@/hooks/tools/useToolsData";
import { CheckoutHistory } from "@/hooks/tools/useToolHistory";
import { ToolStatusBadge } from "./ToolStatusBadge";
import { IssueCard } from "@/components/IssueCard";
import { ToolIssuesSummary } from "@/components/ToolIssuesSummary";

interface ToolDetailsProps {
  tool: Tool;
  toolHistory: CheckoutHistory[];
  currentCheckout: { user_name: string } | null;
  issues: any[];
  onBack: () => void;
  onResolveIssue: (issue: any) => void;
  onEditIssue?: (issue: any) => void;
}

export const ToolDetails = ({
  tool,
  toolHistory,
  currentCheckout,
  issues,
  onBack,
  onResolveIssue,
  onEditIssue
}: ToolDetailsProps) => {
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
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
                    <span className="font-medium">Storage Vicinity:</span> {tool.storage_vicinity}
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


            <TabsContent value="issues" className="space-y-4">
              <div className="space-y-4">
                {tool.known_issues && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Legacy Known Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {tool.known_issues}
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onResolve={() => onResolveIssue(issue)}
                    onEdit={onEditIssue ? () => onEditIssue(issue) : undefined}
                    onRefresh={() => {}}
                  />
                ))}
                
                {issues.length === 0 && !tool.known_issues && (
                  <p className="text-center text-muted-foreground py-8">
                    No issues reported.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-4">
                {toolHistory.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{record.user_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.type === 'checkin' ? 'Check-in' : 'Checkout'} on{' '}
                            {new Date(record.checkout_date).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={record.is_returned ? 'default' : 'secondary'}>
                          {record.is_returned ? 'Returned' : 'Active'}
                        </Badge>
                      </div>
                      
                      {record.intended_usage && (
                        <p className="text-sm mb-2">
                          <span className="font-medium">Intended Usage:</span> {record.intended_usage}
                        </p>
                      )}
                      
                      {record.notes && (
                        <p className="text-sm mb-2">
                          <span className="font-medium">Notes:</span> {record.notes}
                        </p>
                      )}

                      {record.checkin && (
                        <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                          <p className="font-medium mb-1">Check-in Details:</p>
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
                    </CardContent>
                  </Card>
                ))}
                
                {toolHistory.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No checkout history available.
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