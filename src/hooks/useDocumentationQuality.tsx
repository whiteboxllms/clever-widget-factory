import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentationQualityData {
  averageScore: number;
  totalEdits: number;
  trend: {
    date: string;
    score: number;
    edits: number;
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
          created_at
        `)
        .gte("created_at", oneWeekAgo.toISOString())
        .in("change_type", ["created", "updated", "modified"]);

      if (historyError) {
        console.error("Error fetching parts history:", historyError);
        throw historyError;
      }

      if (!partsHistory || partsHistory.length === 0) {
        return {
          averageScore: 0,
          totalEdits: 0,
          trend: []
        };
      }

      // Get unique part IDs from the history
      const partIds = [...new Set(partsHistory.map(h => h.part_id))];

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

      if (partsError) {
        console.error("Error fetching parts data:", partsError);
        throw partsError;
      }

      if (!partsData || partsData.length === 0) {
        return {
          averageScore: 0,
          totalEdits: 0,
          trend: []
        };
      }

      // Create a map for quick part lookup
      const partsMap = new Map(partsData.map(part => [part.id, part]));

      // Calculate documentation quality score for each edit
      const editsWithScores = partsHistory.map(edit => {
        const part = partsMap.get(edit.part_id);
        
        if (!part) {
          return {
            id: edit.id,
            date: edit.created_at.split('T')[0],
            score: 0,
            part_id: edit.part_id
          };
        }
        
        // Fields that contribute to documentation quality
        // Don't count minimum_quantity as mentioned in requirements
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
          id: edit.id,
          date: edit.created_at.split('T')[0],
          score,
          part_id: edit.part_id
        };
      });

      // Calculate overall average
      const averageScore = editsWithScores.reduce((sum, edit) => sum + edit.score, 0) / editsWithScores.length;

      // Group by date for trend analysis
      const dailyData = editsWithScores.reduce((acc, edit) => {
        const date = edit.date;
        if (!acc[date]) {
          acc[date] = { scores: [], count: 0 };
        }
        acc[date].scores.push(edit.score);
        acc[date].count++;
        return acc;
      }, {} as Record<string, { scores: number[], count: number }>);

      // Calculate daily averages
      const trend = Object.entries(dailyData)
        .map(([date, data]) => ({
          date,
          score: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
          edits: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        averageScore,
        totalEdits: editsWithScores.length,
        trend
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}