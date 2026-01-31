import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useStrategicAttributes, CompanyAverage, StrategicAttributeType } from './useStrategicAttributes';
import { fetchActions, fetchActionScores, fetchOrganizationMembers } from '@/lib/queryFetchers';
import type { OrganizationMemberSummary } from '@/types/organization';
import { actionsQueryKey, actionScoresQueryKey, proactiveReactiveQueryKey } from '@/lib/queryKeys';
import { offlineQueryConfig } from '@/lib/queryConfig';

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
  created_by: string;
  scores: Array<{
    score_name: string;
    score: number;
    reason: string;
    how_to_improve?: string;
  }>;
  contexts: Array<{
    context_service: string;
    context_id: string;
  }>;
  created_at: string;
  // Enriched fields (added by frontend)
  assigned_to?: string;
  full_name?: string;
}

export interface EnhancedAttributeFilters {
  userIds?: string[];
  startDate?: string;
  endDate?: string;
}

type AnalyticsOrganizationMember = OrganizationMemberSummary & {
  role?: string | null;
};

type ActionRecord = {
  id: string;
  assigned_to?: string | null;
  full_name?: string | null;
};

type ActionSummary = {
  created_at: string;
  linked_issue_id?: string | null;
};

export function useEnhancedStrategicAttributes(filters: EnhancedAttributeFilters = {}) {
  const { attributes, loading: attributesLoading, fetchAttributes } = useStrategicAttributes();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { startDate, endDate, userIds } = filters;

  const organizationMembersQuery = useQuery<AnalyticsOrganizationMember[]>({
    queryKey: ['organization_members'],
    queryFn: async () => (await fetchOrganizationMembers()) as AnalyticsOrganizationMember[],
    enabled: Boolean(user?.userId),
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const actionsQuery = useQuery<ActionRecord[]>({
    queryKey: actionsQueryKey(),
    queryFn: async () => (await fetchActions()) as ActionRecord[],
    enabled: Boolean(user?.userId),
    ...offlineQueryConfig,
    staleTime: 60 * 1000, // Override with shorter staleTime for actions
  });

  const actionScoresQuery = useQuery<ActionScore[]>({
    queryKey: actionScoresQueryKey(startDate, endDate),
    queryFn: () => fetchActionScores({ startDate, endDate }) as Promise<ActionScore[]>,
    enabled: Boolean(user?.userId && startDate && endDate), // Only fetch when dates are available
    ...offlineQueryConfig,
    staleTime: 60 * 1000, // Override with shorter staleTime for action scores
  });

  const proactiveVsReactiveQuery = useQuery({
    queryKey: proactiveReactiveQueryKey(startDate, endDate),
    queryFn: () => fetchProactiveVsReactiveData(queryClient, startDate, endDate),
    enabled: Boolean(user?.userId && startDate && endDate), // Only fetch when dates are available
    ...offlineQueryConfig,
    staleTime: 60 * 1000, // Override with shorter staleTime for proactive/reactive data
  });

  const organizationMembers = useMemo(
    () => organizationMembersQuery.data ?? [],
    [organizationMembersQuery.data]
  );

  const actions = useMemo(
    () => actionsQuery.data ?? [],
    [actionsQuery.data]
  );

  const actionScores = useMemo<ActionScore[]>(() => {
    const actionsMap = new Map(actions.map(action => [action.id, action]));
    const memberMap = new Map(
      organizationMembers.map(member => [member.user_id, member])
    );

    return (actionScoresQuery.data ?? []).map((analysis) => {
      // Find action_id from contexts
      const actionContext = analysis.contexts?.find((ctx: any) => ctx.context_service === 'action_score');
      const actionId = actionContext?.context_id;
      const action = actionId ? actionsMap.get(actionId) : undefined;
      const assignee = action?.assigned_to ? memberMap.get(action.assigned_to) : undefined;
      
      return {
        ...analysis,
        assigned_to: action?.assigned_to,
        full_name: assignee?.full_name || action?.full_name || 'Unknown User',
      };
    });
  }, [actionScoresQuery.data, actions, organizationMembers]);

  const actionAnalytics = useMemo(
    () => computeActionAnalytics(actionScores, organizationMembers, userIds),
    [actionScores, organizationMembers, userIds]
  );

  const getAttributeAnalytics = useCallback(() => {
    if (!attributes || attributes.length === 0) {
      return [];
    }

    const memberMap = new Map(
      organizationMembers.map(member => [member.user_id, member])
    );

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

    return Array.from(userMap.values());
  }, [attributes, organizationMembers]);

  const getCompanyAverage = (): { attributes: CompanyAverage[] } => {
    // TODO: Calculate actual company averages
    return { attributes: [] };
  };

  const getIssueAnalytics = (userIds?: string[], startDate?: string, endDate?: string): EnhancedAttributeAnalytics[] => {
    // TODO: Implement issue analytics when issue scoring is available
    return [];
  };

  const getActionAnalytics = useCallback((customUserIds?: string[]) => {
    return computeActionAnalytics(actionScores, organizationMembers, customUserIds);
  }, [actionScores, organizationMembers]);

  const isLoading =
    attributesLoading ||
    organizationMembersQuery.isLoading ||
    actionScoresQuery.isLoading ||
    actionsQuery.isLoading;

  const getProactiveVsReactiveData = useCallback(async (rangeStart?: string, rangeEnd?: string) => {
    return queryClient.fetchQuery({
      queryKey: proactiveReactiveQueryKey(rangeStart, rangeEnd),
      queryFn: () => fetchProactiveVsReactiveData(queryClient, rangeStart, rangeEnd),
    });
  }, [queryClient]);

  const fetchAllData = useCallback(async (_userIds?: string[], startParam?: string, endParam?: string) => {
    const nextStart = startParam ?? startDate;
    const nextEnd = endParam ?? endDate;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: actionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: actionScoresQueryKey(nextStart, nextEnd) }),
      queryClient.invalidateQueries({ queryKey: proactiveReactiveQueryKey(nextStart, nextEnd) }),
    ]);
  }, [endDate, queryClient, startDate]);

  return {
    attributes,
    actionScores,
    organizationMembers,
    actionAnalytics,
    isLoading,
    fetchAttributes,
    getAttributeAnalytics,
    getActionAnalytics,
    getIssueAnalytics,
    getCompanyAverage,
    getProactiveVsReactiveData,
    proactiveVsReactiveData: proactiveVsReactiveQuery.data ?? [],
    isFetchingProactive: proactiveVsReactiveQuery.isFetching,
    getDayActions: () => [],
    fetchAllData,
  };
}

function computeActionAnalytics(
  actionScores: ActionScore[],
  organizationMembers: AnalyticsOrganizationMember[],
  userIds?: string[]
): EnhancedAttributeAnalytics[] {
  if (!actionScores || actionScores.length === 0) {
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

    // Handle new array format from analyses API
    const scoresArray = actionScore.scores || [];
    scoresArray.forEach(scoreItem => {
      const attributeKey = mapScoredAttributeToStrategic(scoreItem.score_name);
      if (!attributeKey) return;

      const currentSum = user.attributes[attributeKey] || 0;
      const currentCount = user.scoreCount![attributeKey] || 0;
      
      // Convert -2 to 2 scale to 0 to 4 scale
      const normalizedScore = scoreItem.score + 2;
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

  return Array.from(userMap.values());
}

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

const fetchProactiveVsReactiveData = async (queryClient: QueryClient, startDate?: string, endDate?: string) => {
  try {
    // Prefer existing cached actions; only hit the network if absolutely necessary
    let actionsData = queryClient.getQueryData<ActionSummary[]>(actionsQueryKey());
    if (!actionsData) {
      actionsData = await queryClient.ensureQueryData<ActionSummary[]>({
        queryKey: actionsQueryKey(),
        queryFn: async () => (await fetchActions()) as ActionSummary[],
        staleTime: 60 * 1000,
      });
    }

    let data = actionsData || [];

    if (startDate || endDate) {
      data = data.filter((action) => {
        const actionDate = new Date(action.created_at);
        if (startDate && actionDate < new Date(startDate)) return false;
        if (endDate && actionDate > new Date(endDate + 'T23:59:59')) return false;
        return true;
      });
    }

    const dayMap = new Map<string, { proactive: number; reactive: number }>();
    
    data.forEach((action) => {
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

    return Array.from(dayMap.entries())
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
  } catch (error) {
    console.error('Error fetching proactive vs reactive data:', error);
    return [];
  }
};
