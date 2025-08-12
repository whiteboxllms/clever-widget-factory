import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentationQualityDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  activityType: string;
}

export function DocumentationQualityDetailsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  activityType
}: DocumentationQualityDetailsDialogProps) {
  const { data: details, isLoading } = useQuery({
    queryKey: ["documentation-quality-details", userId, activityType],
    queryFn: async () => {
      console.log(`Fetching documentation quality details for ${userName} - ${activityType}`);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      if (activityType === "Used") {
        // Get inventory usage data
        const { data: inventoryUsage, error } = await supabase
          .from("inventory_usage")
          .select(`
            id,
            part_id,
            created_at,
            parts!inner(
              id,
              name,
              description,
              category,
              storage_location,
              supplier,
              cost_per_unit,
              image_url
            )
          `)
          .eq("used_by", userId)
          .gte("created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        return inventoryUsage?.map(usage => ({
          id: usage.id,
          part_id: usage.part_id,
          created_at: usage.created_at,
          type: "used",
          part: usage.parts
        })) || [];
      } else {
        // Get parts history data
        const changeType = activityType === "Created" ? "create" : "update";
        const { data: partsHistory, error } = await supabase
          .from("parts_history")
          .select(`
            id,
            part_id,
            change_type,
            created_at,
            parts!inner(
              id,
              name,
              description,
              category,
              storage_location,
              supplier,
              cost_per_unit,
              image_url
            )
          `)
          .eq("changed_by", userId)
          .eq("change_type", changeType)
          .gte("created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;

        return partsHistory?.map(history => ({
          id: history.id,
          part_id: history.part_id,
          created_at: history.created_at,
          type: history.change_type,
          part: history.parts
        })) || [];
      }
    },
    enabled: open && !!userId && !!activityType,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const calculateScore = (part: any) => {
    const fields = {
      description: part.description,
      category: part.category,
      storage_location: part.storage_location,
      supplier: part.supplier,
      cost_per_unit: part.cost_per_unit,
      image_url: part.image_url
    };

    const filledFields = Object.values(fields).filter(value => 
      value !== null && value !== undefined && value !== ''
    ).length;

    return Math.round((filledFields / 6) * 100);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-task-complete";
    if (score >= 60) return "text-task-implementation";
    if (score >= 40) return "text-mission-construction";
    return "text-destructive";
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Documentation Quality Details - {userName} ({activityType})
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Documentation Quality Score:</strong> Percentage of important fields filled out for each part.
            </p>
            <p>
              <strong>Tracked Fields:</strong> Description, Category, Storage Location, Supplier, Cost per Unit, Image
            </p>
            <p>
              <strong>Score Calculation:</strong> (Filled Fields ÷ 6) × 100%
            </p>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">Loading details...</p>
            </div>
          ) : !details || details.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {details.map((transaction) => {
                const score = calculateScore(transaction.part);
                return (
                  <Card key={transaction.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{transaction.part.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={getScoreBadgeVariant(score)}
                            className="font-medium"
                          >
                            {score}% Quality
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Description:</span>
                          <p className={transaction.part.description ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.description || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Category:</span>
                          <p className={transaction.part.category ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.category || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Storage Location:</span>
                          <p className={transaction.part.storage_location ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.storage_location || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Supplier:</span>
                          <p className={transaction.part.supplier ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.supplier || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Cost per Unit:</span>
                          <p className={transaction.part.cost_per_unit ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.cost_per_unit ? `$${transaction.part.cost_per_unit}` : "Not provided"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Image:</span>
                          <p className={transaction.part.image_url ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.image_url ? "Provided" : "Not provided"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}