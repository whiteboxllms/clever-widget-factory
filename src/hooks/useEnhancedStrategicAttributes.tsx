import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStrategicAttributes, AttributeAnalytics, CompanyAverage, StrategicAttributeType } from './useStrategicAttributes';

interface EnhancedAttributeAnalytics {
  userId: string;
  userName: string;
  userRole: string;
  attributes: Record<StrategicAttributeType, number>;
  scoreCount?: Record<StrategicAttributeType, number>;
  totalActions?: number;
}

interface ActionScore {
  id: string;
  action_id: string;
  assigned_to: string;
  full_name: string;
  scores: Record<string, { score: number; reason: string }>;
  created_at: string;
}

export function useEnhancedStrategicAttributes() {
  const { attributes, isLoading: attributesLoading, fetchAttributes, getAttributeAnalytics, getCompanyAverage } = useStrategicAttributes();
  const [actionScores, setActionScores] = useState<ActionScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchActionScores = async (userIds?: string[], startDate?: string, endDate?: string) => {
    try {
      let query = supabase
        .from('action_scores')
        .select(`
          id,
          action_id,
          scores,
          created_at,
          actions!inner(
            id,
            assigned_to,
            title,
            profiles!assigned_to(
              full_name
            )
          )
        `);

      // Apply date filters if provided
      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to match our interface
      const transformedScores: ActionScore[] = (data || []).map((item: any) => ({
        id: item.id,
        action_id: item.action_id,
        assigned_to: item.actions.assigned_to,
        full_name: item.actions.profiles?.full_name || 'Unknown User',
        scores: item.scores,
        created_at: item.created_at
      })).filter(score => {
        // Filter by user IDs if provided
        if (userIds && userIds.length > 0) {
          return userIds.includes(score.assigned_to);
        }
        return true;
      });

      setActionScores(transformedScores);
    } catch (error) {
      console.error('Error fetching action scores:', error);
      toast({
        title: "Error",
        description: "Failed to fetch action scores",
        variant: "destructive",
      });
    }
  };

  const fetchAllData = async (userIds?: string[], startDate?: string, endDate?: string) => {
    setIsLoading(true);
    await Promise.all([
      fetchAttributes(userIds, startDate, endDate),
      fetchActionScores(userIds, startDate, endDate)
    ]);
    setIsLoading(false);
  };

  const getEnhancedAttributeAnalytics = (userIds?: string[]): AttributeAnalytics[] => {
    // Create analytics primarily from action scores
    const userAnalyticsMap = new Map<string, EnhancedAttributeAnalytics>();

    // Process action scores
    actionScores.forEach(actionScore => {
      const userId = actionScore.assigned_to;
      const userName = actionScore.full_name;

      if (!userAnalyticsMap.has(userId)) {
        // Initialize with baseline attributes (all set to 1 as starting point)
        userAnalyticsMap.set(userId, {
          userId,
          userName,
          userRole: 'user', // Default role for action-based analytics
          attributes: {
            growth_mindset: 1,
            root_cause_problem_solving: 1,
            teamwork: 1,
            quality: 1,
            proactive_documentation: 1,
            safety_focus: 1,
            efficiency: 1,
            asset_stewardship: 1,
            financial_impact: 1,
            energy_morale_impact: 1
          },
          scoreCount: {
            growth_mindset: 0,
            root_cause_problem_solving: 0,
            teamwork: 0,
            quality: 0,
            proactive_documentation: 0,
            safety_focus: 0,
            efficiency: 0,
            asset_stewardship: 0,
            financial_impact: 0,
            energy_morale_impact: 0
          },
          totalActions: 0
        });
      }

      const userAnalytics = userAnalyticsMap.get(userId)!;
      userAnalytics.totalActions++;

      // Process each score in the action
      Object.entries(actionScore.scores).forEach(([attribute, scoreData]) => {
        const mappedAttribute = mapScoredAttributeToStrategic(attribute);
        
        if (mappedAttribute) {
          // Add to running average (scores are 0-5 range)
          const currentCount = userAnalytics.scoreCount![mappedAttribute];
          const currentAvg = userAnalytics.attributes[mappedAttribute];
          const newScore = Math.max(0, Math.min(5, scoreData.score));
          
          // Calculate new average
          userAnalytics.attributes[mappedAttribute] = 
            (currentAvg * currentCount + newScore) / (currentCount + 1);
          userAnalytics.scoreCount![mappedAttribute]++;
        }
      });
    });

    // Convert map to array and filter by userIds if provided
    let result = Array.from(userAnalyticsMap.values());
    
    if (userIds && userIds.length > 0) {
      result = result.filter(analytics => userIds.includes(analytics.userId));
    }

    // Convert to AttributeAnalytics format (remove extra properties)
    return result.map(analytics => ({
      userId: analytics.userId,
      userName: analytics.userName,
      userRole: analytics.userRole,
      attributes: analytics.attributes
    }));
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
      'Quality': 'quality',
      'Efficiency': 'efficiency',
      'Safety Focus': 'safety_focus',
      'Teamwork and Transparent Communication': 'teamwork',
      'Root Cause Problem Solving': 'root_cause_problem_solving',
      'Proactive Documentation': 'proactive_documentation',
      'Asset Stewardship': 'asset_stewardship',
      'Financial Impact': 'financial_impact',
      'Energy & Morale Impact': 'energy_morale_impact',
      'Growth Mindset': 'growth_mindset'
    };

    // Exact match first
    if (mapping[scoredAttribute]) {
      return mapping[scoredAttribute];
    }

    // Fallback to partial matching
    const lowerCaseAttribute = scoredAttribute.toLowerCase();
    for (const [key, value] of Object.entries(mapping)) {
      if (lowerCaseAttribute.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCaseAttribute)) {
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
    actionScores,
    isLoading: isLoading || attributesLoading,
    fetchAllData,
    getEnhancedAttributeAnalytics,
    getEnhancedCompanyAverage,
    // Also expose the base methods for compatibility
    fetchAttributes,
    getAttributeAnalytics,
    getCompanyAverage
  };
}