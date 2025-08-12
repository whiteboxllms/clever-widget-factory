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

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Get all parts that were updated in the last week
      const { data: recentParts, error: partsError } = await supabase
        .from('parts')
        .select('id, name, description, storage_location, supplier, cost_per_unit, image_url, updated_at')
        .gte('updated_at', oneWeekAgo.toISOString())
        .order('updated_at', { ascending: false });

      if (partsError) throw partsError;

      if (!recentParts || recentParts.length === 0) {
        return { userScores: [] };
      }

      // For each part, find who last updated it from parts_history
      const partIds = recentParts.map(p => p.id);
      const { data: partsHistory, error: historyError } = await supabase
        .from('parts_history')
        .select('part_id, changed_by, created_at, change_type')
        .in('part_id', partIds)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;

      // Create a map of part_id to last updater
      const lastUpdaterMap = new Map();
      const lastUpdateTypeMap = new Map();
      
      (partsHistory || []).forEach(history => {
        if (!lastUpdaterMap.has(history.part_id)) {
          lastUpdaterMap.set(history.part_id, history.changed_by);
          lastUpdateTypeMap.set(history.part_id, history.change_type === 'create' ? 'created' : 'modified');
        }
      });

      // Get user profiles for display names
      const allUserIds = new Set(Array.from(lastUpdaterMap.values()));
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(allUserIds));

      if (profilesError) throw profilesError;

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Helper function to calculate documentation quality score (removed category)
      const calculateScore = (part: any) => {
        const fields = ['description', 'storage_location', 'supplier', 'cost_per_unit', 'image_url'];
        const filledFields = fields.filter(field => part[field] && part[field].toString().trim() !== '');
        return filledFields.length / fields.length;
      };

      // Group by user and calculate scores based on current part state
      const userScores = new Map();

      recentParts.forEach(part => {
        const userId = lastUpdaterMap.get(part.id);
        const activityType = lastUpdateTypeMap.get(part.id) || 'modified';
        
        if (!userId) return; // Skip if we can't determine who updated it

        const userName = profilesMap.get(userId) || 'Unknown User';
        const score = calculateScore(part);

        if (!userScores.has(userId)) {
          userScores.set(userId, {
            user: userId,
            userName,
            created: { count: 0, totalScore: 0, score: 0 },
            modified: { count: 0, totalScore: 0, score: 0 },
            used: { count: 0, totalScore: 0, score: 0 },
            overall: { count: 0, totalScore: 0, score: 0 }
          });
        }

        const userScore = userScores.get(userId);
        userScore[activityType].count++;
        userScore[activityType].totalScore += score;
        userScore[activityType].score = userScore[activityType].totalScore / userScore[activityType].count;

        userScore.overall.count++;
        userScore.overall.totalScore += score;
        userScore.overall.score = userScore.overall.totalScore / userScore.overall.count;
      });

      return {
        userScores: Array.from(userScores.values())
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}