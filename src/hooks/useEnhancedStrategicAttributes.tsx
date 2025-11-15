import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';
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

  const getActionAnalytics = (): EnhancedAttributeAnalytics[] => {
    // For now, return the same as getAttributeAnalytics
    return getAttributeAnalytics();
  };

  const fetchProactiveVsReactiveData = async () => {
    try {
      // Fetch actions data to determine proactive vs reactive
      const { data, error } = await supabase
        .from('actions')
        .select('id, title, linked_issue_id, created_at, assigned_to');

      if (error) throw error;

      // Group by proactive (no linked issue) vs reactive (has linked issue)
      const proactiveCount = data?.filter(action => !action.linked_issue_id).length || 0;
      const reactiveCount = data?.filter(action => action.linked_issue_id).length || 0;

      console.log('Proactive vs Reactive data:', { proactiveCount, reactiveCount });

      const chartData = [
        { name: 'Proactive', value: proactiveCount },
        { name: 'Reactive', value: reactiveCount }
      ];
      
      setProactiveVsReactiveData(chartData);
      return chartData;
    } catch (error) {
      console.error('Error fetching proactive vs reactive data:', error);
      return [];
    }
  };

  const getProactiveVsReactiveData = () => {
    return proactiveVsReactiveData;
  };

  const fetchOrganizationMembers = async () => {
    if (!user?.userId) return;
    
    try {
      // Fetch organization members directly (RLS disabled temporarily)
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, full_name, role');

      if (error) throw error;
      
      console.log('Organization members fetched:', data);
      setOrganizationMembers(data || []);
    } catch (error) {
      console.error('Error fetching organization members:', error);
    }
  };

  const fetchActionScores = async (userIds?: string[], startDate?: string, endDate?: string) => {
    // TODO: Implement action scores fetching
    setActionScores([]);
    setIsLoading(false);
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
    getCompanyAverage,
    getProactiveVsReactiveData,
    fetchAttributes,
    // Add a trigger function for the dashboard to call when it needs fresh data
    refreshAnalytics: () => {
      console.log('🔄 refreshAnalytics called');
      fetchAttributes();
      fetchOrganizationMembers();
      fetchProactiveVsReactiveData();
    }
  };
}
