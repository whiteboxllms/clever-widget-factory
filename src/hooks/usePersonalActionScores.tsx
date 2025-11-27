import { useState, useEffect } from 'react';
import { apiService } from '@/lib/apiService';

interface ActionScore {
  id: string;
  action_id: string;
  scores: Record<string, { score: number; reason: string }>;
  created_at: string;
}

interface AggregatedScores {
  [attribute: string]: {
    avgScore: number;
    count: number;
  };
}

export const usePersonalActionScores = (userId?: string, startDate?: string, endDate?: string) => {
  const [aggregatedScores, setAggregatedScores] = useState<AggregatedScores>({});
  const [isLoading, setIsLoading] = useState(false);
  const [totalScores, setTotalScores] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetchScores = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ user_id: userId });
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const response = await apiService.get<{ data: ActionScore[] }>(`/action_scores?${params}`);
        const scores = response.data || [];
        
        setTotalScores(scores.length);

        // Aggregate scores by attribute
        const aggregated: AggregatedScores = {};
        
        scores.forEach(score => {
          Object.entries(score.scores).forEach(([attribute, { score: value }]) => {
            if (!aggregated[attribute]) {
              aggregated[attribute] = { avgScore: 0, count: 0 };
            }
            aggregated[attribute].avgScore += value;
            aggregated[attribute].count += 1;
          });
        });

        // Calculate averages
        Object.keys(aggregated).forEach(attr => {
          aggregated[attr].avgScore = aggregated[attr].avgScore / aggregated[attr].count;
        });

        setAggregatedScores(aggregated);
      } catch (error) {
        console.error('Error fetching personal action scores:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScores();
  }, [userId, startDate, endDate]);

  return { aggregatedScores, isLoading, totalScores };
};
