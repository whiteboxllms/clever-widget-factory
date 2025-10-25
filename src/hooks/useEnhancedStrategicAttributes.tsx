import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStrategicAttributes, AttributeAnalytics, CompanyAverage, StrategicAttributeType } from './useStrategicAttributes';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';

export interface EnhancedAttributeAnalytics {
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
  const { getOrganizationValues } = useOrganizationValues();
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
            organization_members!fk_actions_assigned_to_organization_members(
              full_name
            )
          )
        `)
        .eq('source_type', 'action');

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
        full_name: item.actions.organization_members?.full_name || 'Unknown User',
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

  const fetchIssueScores = async (userIds?: string[], startDate?: string, endDate?: string): Promise<ActionScore[]> => {
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
            organization_members!fk_actions_assigned_to_organization_members(
              full_name
            )
          )
        `)
        .eq('source_type', 'issue');

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
        full_name: item.actions.organization_members?.full_name || 'Unknown User',
        scores: item.scores,
        created_at: item.created_at
      })).filter(score => {
        // Filter by user IDs if provided
        if (userIds && userIds.length > 0) {
          return userIds.includes(score.assigned_to);
        }
        return true;
      });

      return transformedScores;
    } catch (error) {
      console.error('Error fetching issue scores:', error);
      return [];
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
            growth_mindset: 2,
            root_cause_problem_solving: 2,
            teamwork: 2,
            quality: 2,
            proactive_documentation: 2,
            safety_focus: 2,
            efficiency: 2,
            asset_stewardship: 2,
            financial_impact: 2,
            energy_morale_impact: 2
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
          // Add to running average (scores are -2 to 2 range, shift to 0-4)
          const currentCount = userAnalytics.scoreCount![mappedAttribute];
          const currentAvg = userAnalytics.attributes[mappedAttribute];
          const adjustedScore = Math.max(0, Math.min(4, scoreData.score + 2));
          
          // Calculate new average
          userAnalytics.attributes[mappedAttribute] = 
            (currentAvg * currentCount + adjustedScore) / (currentCount + 1);
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

  const getActionAnalytics = async (userIds?: string[], filterByOrgValues = true): Promise<EnhancedAttributeAnalytics[]> => {
    try {
      // Get organization's selected strategic attributes
      const orgValues = filterByOrgValues ? await getOrganizationValues() : [];
      const attributesToUse = orgValues.length > 0 ? orgValues : [
        'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
        'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
        'financial_impact', 'energy_morale_impact'
      ] as StrategicAttributeType[];

      // Directly fetch action scores from database
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
            organization_members!fk_actions_assigned_to_organization_members(
              full_name
            )
          )
        `)
        .eq('source_type', 'action');

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to match our interface
      const freshActionScores: ActionScore[] = (data || []).map((item: any) => ({
        id: item.id,
        action_id: item.action_id,
        assigned_to: item.actions.assigned_to,
        full_name: item.actions.organization_members?.full_name || 'Unknown User',
        scores: item.scores,
        created_at: item.created_at
      })).filter(score => {
        // Filter by user IDs if provided
        if (userIds && userIds.length > 0) {
          return userIds.includes(score.assigned_to);
        }
        return true;
      });

      // Create analytics primarily from action scores
      const userAnalyticsMap = new Map<string, EnhancedAttributeAnalytics>();

      // First, get total action counts for all users to show realistic totals
      let totalActionsQuery = supabase
        .from('actions')
        .select('assigned_to')
        .not('assigned_to', 'is', null);

      if (userIds && userIds.length > 0) {
        totalActionsQuery = totalActionsQuery.in('assigned_to', userIds);
      }

      const { data: totalActionsData, error: totalActionsError } = await totalActionsQuery;
      if (totalActionsError) throw totalActionsError;

      // Count total actions per user
      const totalActionCounts = new Map<string, number>();
      totalActionsData?.forEach(action => {
        const userId = action.assigned_to;
        totalActionCounts.set(userId, (totalActionCounts.get(userId) || 0) + 1);
      });


      // Process action scores for attribute scoring
      freshActionScores.forEach(actionScore => {
      const userId = actionScore.assigned_to;
      const userName = actionScore.full_name;

      if (!userAnalyticsMap.has(userId)) {
        // Initialize with baseline attributes (all set to 2 as starting point)
        userAnalyticsMap.set(userId, {
          userId,
          userName,
          userRole: 'user', // Default role for action-based analytics
          attributes: {
            growth_mindset: 2,
            root_cause_problem_solving: 2,
            teamwork: 2,
            quality: 2,
            proactive_documentation: 2,
            safety_focus: 2,
            efficiency: 2,
            asset_stewardship: 2,
            financial_impact: 2,
            energy_morale_impact: 2
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
          totalActions: totalActionCounts.get(userId) || 0 // Use actual total actions count
        });
      }

      const userAnalytics = userAnalyticsMap.get(userId)!;
      // Don't increment totalActions here since we got the real count above

      // Process each score in the action
      Object.entries(actionScore.scores).forEach(([attribute, scoreData]) => {
        const mappedAttribute = mapScoredAttributeToStrategic(attribute);
        
        if (mappedAttribute) {
          // Add to running average (scores are -2 to 2 range, shift to 0-4)
          const currentCount = userAnalytics.scoreCount![mappedAttribute];
          const currentAvg = userAnalytics.attributes[mappedAttribute];
          const adjustedScore = Math.max(0, Math.min(4, (scoreData as any).score + 2));
          
          // Calculate new average
          userAnalytics.attributes[mappedAttribute] = 
            (currentAvg * currentCount + adjustedScore) / (currentCount + 1);
          userAnalytics.scoreCount![mappedAttribute]++;
        }
      });
    });

    // Add users who have actions but no scores yet
    for (const [userId, actionCount] of totalActionCounts) {
      if (!userAnalyticsMap.has(userId)) {
        // Get user name from organization members
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('full_name')
          .eq('user_id', userId)
          .maybeSingle();

        userAnalyticsMap.set(userId, {
          userId,
          userName: memberData?.full_name || 'Unknown User',
          userRole: 'user',
          attributes: {
            growth_mindset: 2,
            root_cause_problem_solving: 2,
            teamwork: 2,
            quality: 2,
            proactive_documentation: 2,
            safety_focus: 2,
            efficiency: 2,
            asset_stewardship: 2,
            financial_impact: 2,
            energy_morale_impact: 2
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
          totalActions: actionCount
        });
      }
    }

    // Convert map to array and filter by userIds if provided
    let result = Array.from(userAnalyticsMap.values());
    
    if (userIds && userIds.length > 0) {
      result = result.filter(analytics => userIds.includes(analytics.userId));
    }

    return result;
    } catch (error) {
      console.error('Error fetching action analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch action analytics",
        variant: "destructive",
      });
      return [];
    }
  };

  const getIssueAnalytics = async (userIds?: string[], startDate?: string, endDate?: string): Promise<EnhancedAttributeAnalytics[]> => {
    const issueScores = await fetchIssueScores(userIds, startDate, endDate);
    
    // Create a map to track user analytics
    const userAnalyticsMap = new Map<string, EnhancedAttributeAnalytics>();

    issueScores.forEach(issueScore => {
      const userId = issueScore.assigned_to;
      const userName = issueScore.full_name;

      if (!userAnalyticsMap.has(userId)) {
        userAnalyticsMap.set(userId, {
          userId,
          userName,
          userRole: 'user',
          attributes: {
            growth_mindset: 2,
            root_cause_problem_solving: 2,
            teamwork: 2,
            quality: 2,
            proactive_documentation: 2,
            safety_focus: 2,
            efficiency: 2,
            asset_stewardship: 2,
            financial_impact: 2,
            energy_morale_impact: 2
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
          }
        });
      }

      const userAnalytics = userAnalyticsMap.get(userId)!;

      // Process scores
      Object.entries(issueScore.scores).forEach(([attribute, scoreData]: [string, any]) => {
        const mappedAttribute = mapScoredAttributeToStrategic(attribute);
        
        if (mappedAttribute) {
          const currentCount = userAnalytics.scoreCount![mappedAttribute];
          const currentAvg = userAnalytics.attributes[mappedAttribute];
          const adjustedScore = Math.max(0, Math.min(4, scoreData.score + 2));
          
          userAnalytics.attributes[mappedAttribute] = 
            (currentAvg * currentCount + adjustedScore) / (currentCount + 1);
          userAnalytics.scoreCount![mappedAttribute]++;
        }
      });
    });

    return Array.from(userAnalyticsMap.values());
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

  const getProactiveVsReactiveData = async (startDate?: string, endDate?: string) => {
    try {
      
      // Get all actions in the date range
      let allActionsQuery = supabase
        .from('actions')
        .select('id, linked_issue_id, created_at');

      if (startDate && endDate) {
        // Convert endDate to end of day to include all actions from that date
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        const endDateISO = endOfDay.toISOString();
        
        console.log('Date range query:', { startDate, endDate, endDateISO });
        allActionsQuery = allActionsQuery.gte('created_at', startDate).lte('created_at', endDateISO);
      }

      const { data: allActions, error: allError } = await allActionsQuery;
      if (allError) throw allError;

      if (!allActions || allActions.length === 0) {
        return [];
      }

      // Group actions by day
      const dailyData = new Map<string, { proactive: number; reactive: number; total: number }>();

      allActions.forEach(action => {
        const date = new Date(action.created_at);
        // Get the date in YYYY-MM-DD format
        const dayKey = date.toISOString().split('T')[0];
        
        if (!dailyData.has(dayKey)) {
          dailyData.set(dayKey, { proactive: 0, reactive: 0, total: 0 });
        }
        
        const dayData = dailyData.get(dayKey)!;
        dayData.total++;
        
        if (action.linked_issue_id) {
          dayData.reactive++;
        } else {
          dayData.proactive++;
        }
      });

      // Convert to chart data format and sort by date
      const chartData = Array.from(dailyData.entries())
        .map(([dayKey, data]) => {
          const proactivePercent = data.total > 0 ? (data.proactive / data.total) * 100 : 0;
          const reactivePercent = data.total > 0 ? (data.reactive / data.total) * 100 : 0;
          
          // Format day for display (MM/DD)
          const dayDate = new Date(dayKey);
          const formatDate = (date: Date) => {
            return `${date.getMonth() + 1}/${date.getDate()}`;
          };
          
          return {
            name: formatDate(dayDate),
            proactive: proactivePercent,
            reactive: reactivePercent,
            totalActions: data.total,
            proactiveCount: data.proactive,
            reactiveCount: data.reactive,
            dayKey
          };
        })
        .sort((a, b) => new Date(a.dayKey).getTime() - new Date(b.dayKey).getTime());

      return chartData;
    } catch (error) {
      console.error('Error fetching proactive vs reactive data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch proactive vs reactive data",
        variant: "destructive",
      });
      return [];
    }
  };

  const getDayActions = async (dayKey: string) => {
    try {
      const startOfDay = new Date(dayKey);
      const endOfDay = new Date(dayKey);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const { data, error } = await supabase
        .from('actions')
        .select(`
          id,
          title,
          status,
          linked_issue_id,
          created_at,
          profiles!assigned_to(
            full_name
          )
        `)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((action: any) => ({
        id: action.id,
        title: action.title,
        status: action.status,
        linked_issue_id: action.linked_issue_id,
         assignee: action.organization_members
      }));
    } catch (error) {
      console.error('Error fetching day actions:', error);
      return [];
    }
  };

  return {
    attributes,
    actionScores,
    isLoading: isLoading || attributesLoading,
    fetchAllData,
    getEnhancedAttributeAnalytics,
    getActionAnalytics,
    getIssueAnalytics,
    getProactiveVsReactiveData,
    getDayActions,
    // Also expose the base methods for compatibility
    fetchAttributes,
    getAttributeAnalytics,
    getCompanyAverage
  };
}