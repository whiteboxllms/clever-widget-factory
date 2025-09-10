import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CombinedAsset } from "@/hooks/useCombinedAssets";
import { IssueCard } from "@/components/IssueCard";

interface StockDetailsProps {
  stock: CombinedAsset;
  stockHistory: any[];
  issues: any[];
  onBack: () => void;
  onResolveIssue: (issue: any) => void;
  onEditIssue?: (issue: any) => void;
  onRefresh?: () => void;
}

export const StockDetails = ({
  stock,
  stockHistory,
  issues,
  onBack,
  onResolveIssue,
  onEditIssue,
  onRefresh
}: StockDetailsProps) => {
  const getStockStatusBadge = () => {
    if (stock.current_quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (stock.current_quantity <= (stock.minimum_quantity || 0)) {
      return <Badge variant="outline">Low Stock</Badge>;
    }
    return <Badge variant="default">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assets
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{stock.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {getStockStatusBadge()}
            <Badge variant="secondary">Stock Item</Badge>
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
                  <CardTitle>Stock Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="font-medium">Category:</span> {stock.category || 'Uncategorized'}
                  </div>
                  <div>
                    <span className="font-medium">Description:</span> {stock.description || 'No description'}
                  </div>
                  <div>
                    <span className="font-medium">Current Quantity:</span> {stock.current_quantity} {stock.unit || 'pieces'}
                  </div>
                  <div>
                    <span className="font-medium">Minimum Quantity:</span> {stock.minimum_quantity || 0} {stock.unit || 'pieces'}
                  </div>
                  {stock.cost_per_unit && (
                    <div>
                      <span className="font-medium">Cost per Unit:</span> ${stock.cost_per_unit}
                    </div>
                  )}
                  {stock.supplier && (
                    <div>
                      <span className="font-medium">Supplier:</span> {stock.supplier}
                    </div>
                  )}
                  {stock.storage_vicinity && (
                    <div>
                      <span className="font-medium">Storage Vicinity:</span> {stock.storage_vicinity}
                    </div>
                  )}
                  {stock.storage_location && (
                    <div>
                      <span className="font-medium">Storage Location:</span> {stock.storage_location}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              <div className="space-y-4">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onResolve={() => onResolveIssue(issue)}
                    onEdit={onEditIssue ? () => onEditIssue(issue) : undefined}
                    onRefresh={onRefresh || (() => {})}
                  />
                ))}
                
                {issues.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No issues reported.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="space-y-4">
                {stockHistory.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{record.change_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(record.changed_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {record.change_type?.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      {record.quantity_change && (
                        <p className="text-sm mb-2">
                          <span className="font-medium">Quantity Change:</span> {record.quantity_change > 0 ? '+' : ''}{record.quantity_change}
                        </p>
                      )}
                      
                      {record.old_quantity !== null && record.new_quantity !== null && (
                        <p className="text-sm mb-2">
                          <span className="font-medium">Quantity:</span> {record.old_quantity} → {record.new_quantity}
                        </p>
                      )}
                      
                      {record.change_reason && (
                        <p className="text-sm text-muted-foreground">
                          {record.change_reason}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {stockHistory.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No history available.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {stock.image_url && (
            <Card>
              <CardContent className="p-4">
                <img
                  src={stock.image_url}
                  alt={stock.name}
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