import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentationQualityData {
  userScores: {
    user: string;
    userName: string;
    created: { score: number; count: number };
    modified: { score: number; count: number };
    used: { score: number; count: number };
    overall: { score: number; count: number };
  }[];
}

export function useDocumentationQuality() {
  return useQuery({
    queryKey: ["documentation-quality"],
    queryFn: async (): Promise<DocumentationQualityData> => {
      console.log("Fetching documentation quality data...");

      // Get all parts edits from the last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get parts history for the last week (modifications and creations)
      const { data: partsHistory, error: historyError } = await supabase
        .from("parts_history")
        .select(`
          id,
          part_id,
          change_type,
          created_at,
          changed_by
        `)
        .gte("created_at", oneWeekAgo.toISOString())
        .in("change_type", ["create", "update"]);

      // Get inventory usage for the last week
      const { data: inventoryUsage, error: usageError } = await supabase
        .from("inventory_usage")
        .select(`
          id,
          part_id,
          used_by,
          created_at
        `)
        .gte("created_at", oneWeekAgo.toISOString());

      if (historyError || usageError) {
        console.error("Error fetching data:", historyError || usageError);
        throw historyError || usageError;
      }

      // Combine all activities
      const allActivities = [
        ...(partsHistory || []).map(h => ({
          part_id: h.part_id,
          user_id: h.changed_by,
          type: h.change_type,
          created_at: h.created_at
        })),
        ...(inventoryUsage || []).map(u => ({
          part_id: u.part_id,
          user_id: u.used_by,
          type: 'used',
          created_at: u.created_at
        }))
      ];

      if (allActivities.length === 0) {
        return { userScores: [] };
      }

      // Get unique part IDs
      const partIds = [...new Set(allActivities.map(a => a.part_id))];

      // Get current part data for scoring
      const { data: partsData, error: partsError } = await supabase
        .from("parts")
        .select(`
          id,
          name,
          description,
          category,
          storage_location,
          supplier,
          cost_per_unit,
          image_url
        `)
        .in("id", partIds);

      // Get user names
      const userIds = [...new Set(allActivities.map(a => a.user_id))];
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (partsError || userError) {
        console.error("Error fetching parts or users:", partsError || userError);
        throw partsError || userError;
      }

      // Create lookup maps
      const partsMap = new Map((partsData || []).map(part => [part.id, part]));
      const usersMap = new Map((userData || []).map(user => [user.user_id, user.full_name || 'Unknown User']));

      // Calculate documentation quality score for each activity
      const activitiesWithScores = allActivities.map(activity => {
        const part = partsMap.get(activity.part_id);
        
        if (!part) {
          return {
            user_id: activity.user_id,
            type: activity.type,
            score: 0
          };
        }
        
        // Fields that contribute to documentation quality
        const fields = {
          description: part.description,
          category: part.category,
          storage_location: part.storage_location,
          supplier: part.supplier,
          cost_per_unit: part.cost_per_unit,
          image_url: part.image_url
        };

        // Count filled fields (non-null and non-empty strings)
        const filledFields = Object.values(fields).filter(value => 
          value !== null && value !== undefined && value !== ''
        ).length;

        const totalFields = Object.keys(fields).length;
        const score = filledFields / totalFields;

        return {
          user_id: activity.user_id,
          type: activity.type,
          score
        };
      });

      // Group by user and activity type
      const userScores = userIds.map(userId => {
        const userName = usersMap.get(userId) || 'Unknown User';
        const userActivities = activitiesWithScores.filter(a => a.user_id === userId);
        
        const created = userActivities.filter(a => a.type === 'create');
        const modified = userActivities.filter(a => a.type === 'update');
        const used = userActivities.filter(a => a.type === 'used');

        const calculateAverage = (activities: typeof userActivities) => {
          if (activities.length === 0) return { score: 0, count: 0 };
          const avgScore = activities.reduce((sum, a) => sum + a.score, 0) / activities.length;
          return { score: avgScore, count: activities.length };
        };

        const createdStats = calculateAverage(created);
        const modifiedStats = calculateAverage(modified);
        const usedStats = calculateAverage(used);
        const overallStats = calculateAverage(userActivities);

        return {
          user: userId,
          userName,
          created: createdStats,
          modified: modifiedStats,
          used: usedStats,
          overall: overallStats
        };
      }).filter(user => user.overall.count > 0); // Only include users with activities

      return { userScores };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}