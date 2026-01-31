import { useState, useEffect } from 'react';
import { apiService } from '@/lib/apiService';

interface ActionScore {
  id: string;
  action_id: string;
  scores: Array<{ score_name: string; score: number; reason: string }>;
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
        const response = await apiService.get<{ data: ActionScore[] }>(`/analysis/analyses?user_id=${userId}${startDate ? `&start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`);
        const scores = response.data || [];
        
        setTotalScores(scores.length);

        // Aggregate scores by attribute
        const aggregated: AggregatedScores = {};
        
        scores.forEach(score => {
          score.scores?.forEach(({ score_name, score: value }) => {
            if (!aggregated[score_name]) {
              aggregated[score_name] = { avgScore: 0, count: 0 };
            }
            aggregated[score_name].avgScore += value;
            aggregated[score_name].count += 1;
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
