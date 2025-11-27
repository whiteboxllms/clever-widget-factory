import { useState, useEffect } from 'react';
import { apiService, getApiData } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useStrategicAttributes, CompanyAverage, StrategicAttributeType } from './useStrategicAttributes';
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
  const { attributes, loading: attributesLoading, fetchAttributes } = useStrategicAttributes();
  const { getOrganizationValues } = useOrganizationValues();
  const [actionScores, setActionScores] = useState<ActionScore[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([]);
  const [proactiveVsReactiveData, setProactiveVsReactiveData] = useState<any[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const getAttributeAnalytics = (): EnhancedAttributeAnalytics[] => {
    console.log('=== getAttributeAnalytics DEBUG ===');
    console.log('attributes length:', attributes?.length || 0);
    console.log('first few attributes:', attributes?.slice(0, 3));
    console.log('organizationMembers length:', organizationMembers?.length || 0);
    console.log('first few members:', organizationMembers?.slice(0, 3));
    
    if (!attributes || attributes.length === 0) {
      console.log('No attributes found, returning empty array');
      return [];
    }
    
    // Create lookup map for user names
    const memberMap = new Map(
      organizationMembers.map(member => [member.user_id, member])
    );
    
    console.log('memberMap size:', memberMap.size);
    
    // Group attributes by user and convert to the expected format
    const userMap = new Map<string, EnhancedAttributeAnalytics>();
    
    attributes.forEach(attr => {
      if (!userMap.has(attr.user_id)) {
        const member = memberMap.get(attr.user_id);
        userMap.set(attr.user_id, {
          userId: attr.user_id,
          userName: member?.full_name || 'Unknown User',
          userRole: member?.role || 'member',
          attributes: {} as Record<StrategicAttributeType, number>,
          totalActions: 0
        });
      }
      
      const user = userMap.get(attr.user_id)!;
      user.attributes[attr.attribute_type] = attr.level;
    });

    const result = Array.from(userMap.values());
    console.log('Final analytics result length:', result.length);
    console.log('Final analytics result:', result);
    console.log('=== END DEBUG ===');
    return result;
  };

  const getCompanyAverage = (): { attributes: CompanyAverage[] } => {
    // TODO: Calculate actual company averages
    return { attributes: [] };
  };

  const getActionAnalytics = (userIds?: string[]): EnhancedAttributeAnalytics[] => {
    console.log('=== getActionAnalytics (from scored actions) ===');
    console.log('actionScores:', actionScores);
    console.log('userIds filter:', userIds);
    
    if (!actionScores || actionScores.length === 0) {
      console.log('No action scores available');
      return [];
    }

    const memberMap = new Map(
      organizationMembers.map(member => [member.user_id, member])
    );

    const userMap = new Map<string, EnhancedAttributeAnalytics>();

    actionScores.forEach(actionScore => {
      const userId = actionScore.assigned_to;
      if (!userId) return;
      if (userIds && userIds.length > 0 && !userIds.includes(userId)) return;

      if (!userMap.has(userId)) {
        const member = memberMap.get(userId);
        userMap.set(userId, {
          userId,
          userName: member?.full_name || actionScore.full_name || 'Unknown User',
          userRole: member?.role || 'member',
          attributes: {} as Record<StrategicAttributeType, number>,
          scoreCount: {} as Record<StrategicAttributeType, number>,
          totalActions: 0
        });
      }

      const user = userMap.get(userId)!;
      user.totalActions = (user.totalActions || 0) + 1;

      Object.entries(actionScore.scores || {}).forEach(([orgValue, scoreData]) => {
        const attributeKey = mapScoredAttributeToStrategic(orgValue);
        if (!attributeKey) return;

        const currentSum = user.attributes[attributeKey] || 0;
        const currentCount = user.scoreCount![attributeKey] || 0;
        
        // Convert -2 to 2 scale to 0 to 4 scale
        const normalizedScore = scoreData.score + 2;
        user.attributes[attributeKey] = currentSum + normalizedScore;
        user.scoreCount![attributeKey] = currentCount + 1;
      });
    });

    userMap.forEach(user => {
      Object.keys(user.attributes).forEach(key => {
        const attrKey = key as StrategicAttributeType;
        const count = user.scoreCount![attrKey] || 1;
        user.attributes[attrKey] = user.attributes[attrKey] / count;
      });
    });

    const result = Array.from(userMap.values());
    console.log('Action analytics result:', result);
    return result;
  };

  const getIssueAnalytics = (userIds?: string[], startDate?: string, endDate?: string): EnhancedAttributeAnalytics[] => {
    // TODO: Implement issue analytics when issue scoring is available
    return [];
  };

  const mapScoredAttributeToStrategic = (orgValue: string): StrategicAttributeType | null => {
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
    return mapping[orgValue] || null;
  };

  const fetchProactiveVsReactiveData = async (startDate?: string, endDate?: string) => {
    try {
      const response = await apiService.get('/actions');
      let data = getApiData(response) || [];

      // Filter by date range
      if (startDate || endDate) {
        data = data.filter((action: any) => {
          const actionDate = new Date(action.created_at);
          if (startDate && actionDate < new Date(startDate)) return false;
          if (endDate && actionDate > new Date(endDate + 'T23:59:59')) return false;
          return true;
        });
      }

      // Group by day
      const dayMap = new Map<string, { proactive: number; reactive: number }>();
      
      data.forEach((action: any) => {
        const date = new Date(action.created_at);
        const dayKey = date.toISOString().split('T')[0];
        
        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, { proactive: 0, reactive: 0 });
        }
        
        const day = dayMap.get(dayKey)!;
        if (action.linked_issue_id) {
          day.reactive++;
        } else {
          day.proactive++;
        }
      });

      // Convert to chart format
      const chartData = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dayKey, counts]) => {
          const total = counts.proactive + counts.reactive;
          return {
            name: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            proactive: total > 0 ? (counts.proactive / total) * 100 : 0,
            reactive: total > 0 ? (counts.reactive / total) * 100 : 0,
            totalActions: total,
            proactiveCount: counts.proactive,
            reactiveCount: counts.reactive,
            dayKey
          };
        });
      
      setProactiveVsReactiveData(chartData);
      return chartData;
    } catch (error) {
      console.error('Error fetching proactive vs reactive data:', error);
      return [];
    }
  };

  const getProactiveVsReactiveData = (startDate?: string, endDate?: string) => {
    return proactiveVsReactiveData;
  };

  const fetchOrganizationMembers = async () => {
    if (!user?.userId) return;
    
    try {
      const response = await apiService.get('/organization_members');
      const data = getApiData(response) || [];
      
      console.log('Organization members fetched:', data);
      setOrganizationMembers(data);
    } catch (error) {
      console.error('Error fetching organization members:', error);
    }
  };

  const fetchActionScores = async (userIds?: string[], startDate?: string, endDate?: string) => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await apiService.get('/action_scores', { params });
      const scoresData = getApiData(response) || [];

      const actionIds = [...new Set(scoresData.map((score: any) => score.action_id).filter(Boolean))];
      const actionsResponse = await apiService.get('/actions');
      const allActions = getApiData(actionsResponse) || [];
      const actionsMap = new Map(allActions.map((a: any) => [a.id, a]));

      const enrichedScores = scoresData.map((score: any) => {
        const action = actionsMap.get(score.action_id);
        const member = organizationMembers.find(m => m.user_id === action?.assigned_to);
        return {
          ...score,
          assigned_to: action?.assigned_to,
          full_name: member?.full_name || 'Unknown User'
        };
      });

      setActionScores(enrichedScores);
    } catch (error) {
      console.error('Error fetching action scores:', error);
      setActionScores([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only set loading to false when both datasets are ready
    const ready = !attributesLoading && attributes.length > 0 && organizationMembers.length > 0;
    setIsLoading(!ready);
    setDataReady(ready);
    console.log('📊 Loading state update:', { attributesLoading, attributesCount: attributes.length, membersCount: organizationMembers.length, isLoading: !ready, dataReady: ready });
  }, [attributesLoading, attributes, organizationMembers]);

  useEffect(() => {
    if (user?.userId) {
      fetchOrganizationMembers();
      fetchProactiveVsReactiveData();
    }
  }, [user?.userId]);

  // Test effect to see when data is ready
  useEffect(() => {
    if (attributes.length > 0 && organizationMembers.length > 0) {
      console.log('🚀 Data is ready! Testing getAttributeAnalytics...');
      const result = getAttributeAnalytics();
      console.log('🚀 Test result:', result);
    }
  }, [attributes, organizationMembers]);

  return {
    attributes,
    actionScores,
    isLoading,
    dataReady,
    fetchActionScores,
    getAttributeAnalytics,
    getActionAnalytics,
    getIssueAnalytics,
    getCompanyAverage,
    getProactiveVsReactiveData,
    fetchAttributes,
    fetchActionScores,
    getDayActions: () => [], // Placeholder
    fetchAllData: async (userIds?: string[], startDate?: string, endDate?: string) => {
      await Promise.all([
        fetchActionScores(userIds, startDate, endDate),
        fetchOrganizationMembers(),
        fetchProactiveVsReactiveData()
      ]);
    }
  };
}
