import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Edit } from "lucide-react";

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
  const navigate = useNavigate();
  const { data: details, isLoading } = useQuery({
    queryKey: ["documentation-quality-details", userId, activityType],
    queryFn: async () => {
      console.log(`Fetching documentation quality details for ${userName} - ${activityType}`);
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get parts that were updated in the last week by this user
      const changeType = activityType === "Created" ? "create" : "update";
      const { data: partsHistory, error } = await supabase
        .from("parts_history")
        .select("part_id, created_at, change_type")
        .eq("changed_by", userId)
        .eq("change_type", changeType)
        .gte("created_at", oneWeekAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!partsHistory || partsHistory.length === 0) {
        return [];
      }

      // Get unique part IDs to avoid duplicates
      const uniquePartIds = [...new Set(partsHistory.map(h => h.part_id))];
      
      // Get current state of these parts
      const { data: parts, error: partsError } = await supabase
        .from("parts")
        .select("id, name, description, storage_location, supplier, cost_per_unit, image_url, updated_at")
        .in("id", uniquePartIds);

      if (partsError) throw partsError;

      const partsMap = new Map((parts || []).map(p => [p.id, p]));

      // Get the most recent activity date for each part
      const partToLatestActivity = new Map();
      partsHistory.forEach(history => {
        const currentLatest = partToLatestActivity.get(history.part_id);
        if (!currentLatest || new Date(history.created_at) > new Date(currentLatest)) {
          partToLatestActivity.set(history.part_id, history.created_at);
        }
      });

      // Return one entry per unique part
      return uniquePartIds.map(partId => ({
        id: partId, // Use part_id as unique identifier
        part_id: partId,
        created_at: partToLatestActivity.get(partId),
        type: activityType.toLowerCase(),
        part: partsMap.get(partId)
      })).filter(item => item.part); // Filter out items where part wasn't found
    },
    enabled: open && !!userId && !!activityType,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const calculateScore = (part: any) => {
    const fields = {
      description: part.description,
      cost_per_unit: part.cost_per_unit,
      image_url: part.image_url
    };

    const filledFields = Object.values(fields).filter(value => 
      value !== null && value !== undefined && value !== ''
    ).length;

    return Math.round((filledFields / 3) * 100);
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

  const handleEditPart = (partId: string) => {
    navigate(`/inventory?edit=${partId}`);
    onOpenChange(false);
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
              <strong>Documentation Quality Score:</strong> Percentage of optional fields filled out for each part.
            </p>
            <p>
              <strong>Optional Fields:</strong> Description, Cost per Unit, Image
            </p>
            <p>
              <strong>Score Calculation:</strong> (Filled Optional Fields ÷ 3) × 100%
            </p>
            <p>
              <strong>Current State:</strong> Shows the current documentation completeness of parts you've {activityType.toLowerCase()} recently.
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
                  <Card 
                    key={transaction.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleEditPart(transaction.part.id)}
                  >
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
                            {transaction.part.description || "Missing - Add a detailed description"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Cost per Unit:</span>
                          <p className={transaction.part.cost_per_unit ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.cost_per_unit ? `$${transaction.part.cost_per_unit}` : "Missing - Add cost information"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Image:</span>
                          <p className={transaction.part.image_url ? "text-foreground" : "text-muted-foreground italic"}>
                            {transaction.part.image_url ? "Provided" : "Missing - Add a photo for identification"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                            <strong>Tip:</strong> Click anywhere on this card to edit the part and improve your quality score.
                          </div>
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