import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStrategicAttributes, AttributeAnalytics, CompanyAverage, StrategicAttributeType } from './useStrategicAttributes';

interface IssueScore {
  id: string;
  user_id: string;
  scores: Record<string, { score: number; reason: string }>;
  score_attribution_type: 'issue_reporter' | 'issue_responsible';
  created_at: string;
}

export function useEnhancedStrategicAttributes() {
  const { attributes, isLoading: attributesLoading, fetchAttributes, getAttributeAnalytics, getCompanyAverage } = useStrategicAttributes();
  const [issueScores, setIssueScores] = useState<IssueScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchIssueScores = async (userIds?: string[], startDate?: string, endDate?: string) => {
    try {
      // For now, return empty array since we need to implement proper user linking
      // This will be enhanced when the database structure supports direct user linking
      setIssueScores([]);
    } catch (error) {
      console.error('Error fetching issue scores:', error);
      toast({
        title: "Error",
        description: "Failed to fetch issue scores",
        variant: "destructive",
      });
    }
  };

  const fetchAllData = async (userIds?: string[], startDate?: string, endDate?: string) => {
    setIsLoading(true);
    await Promise.all([
      fetchAttributes(userIds, startDate, endDate),
      fetchIssueScores(userIds, startDate, endDate)
    ]);
    setIsLoading(false);
  };

  const getEnhancedAttributeAnalytics = (userIds?: string[]): AttributeAnalytics[] => {
    const baseAnalytics = getAttributeAnalytics(userIds);
    
    // Add issue scoring data to each user
    baseAnalytics.forEach(userAnalytics => {
      const userIssueScores = issueScores.filter(score => score.user_id === userAnalytics.userId);
      
      if (userIssueScores.length > 0) {
        // Calculate average scores for each strategic attribute from issue scores
        const attributeScoreSums: Record<string, { sum: number; count: number }> = {};
        
        userIssueScores.forEach(issueScore => {
          Object.entries(issueScore.scores).forEach(([attribute, scoreData]) => {
            if (!attributeScoreSums[attribute]) {
              attributeScoreSums[attribute] = { sum: 0, count: 0 };
            }
            attributeScoreSums[attribute].sum += scoreData.score;
            attributeScoreSums[attribute].count += 1;
          });
        });

        // Map scored attributes to strategic attributes and add to base levels
        Object.entries(attributeScoreSums).forEach(([attribute, data]) => {
          const avgScore = data.sum / data.count;
          const mappedAttribute = mapScoredAttributeToStrategic(attribute);
          
          if (mappedAttribute) {
            // Normalize score impact (assuming scores range from -5 to +5)
            const normalizedImpact = Math.max(-2, Math.min(2, avgScore / 2.5));
            userAnalytics.attributes[mappedAttribute] = Math.max(0, Math.min(5, 
              userAnalytics.attributes[mappedAttribute] + normalizedImpact
            ));
          }
        });
      }
    });

    return baseAnalytics;
  };

  const getEnhancedCompanyAverage = (userIds?: string[]): CompanyAverage => {
    const enhancedAnalytics = getEnhancedAttributeAnalytics(userIds);
    const averages: Record<StrategicAttributeType, number> = {} as Record<StrategicAttributeType, number>;

    const allAttributeTypes: StrategicAttributeType[] = [
      'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
      'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
      'financial_impact', 'energy_morale_impact'
    ];

    allAttributeTypes.forEach(type => {
      const sum = enhancedAnalytics.reduce((acc, user) => acc + user.attributes[type], 0);
      averages[type] = enhancedAnalytics.length > 0 ? sum / enhancedAnalytics.length : 0;
    });

    return { attributes: averages };
  };

  // Map scored attributes to strategic attributes
  const mapScoredAttributeToStrategic = (scoredAttribute: string): StrategicAttributeType | null => {
    const mapping: Record<string, StrategicAttributeType> = {
      'quality': 'quality',
      'efficiency': 'efficiency',
      'safety': 'safety_focus',
      'teamwork': 'teamwork',
      'problem_solving': 'root_cause_problem_solving',
      'documentation': 'proactive_documentation',
      'asset_care': 'asset_stewardship',
      'financial_impact': 'financial_impact',
      'morale': 'energy_morale_impact',
      'growth': 'growth_mindset'
    };

    // Find the best match (case-insensitive, partial matching)
    const lowerCaseAttribute = scoredAttribute.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (lowerCaseAttribute.includes(key) || key.includes(lowerCaseAttribute)) {
        return value;
      }
    }

    return null;
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return {
    attributes,
    issueScores,
    isLoading: isLoading || attributesLoading,
    fetchAllData,
    getEnhancedAttributeAnalytics,
    getEnhancedCompanyAverage
  };
}