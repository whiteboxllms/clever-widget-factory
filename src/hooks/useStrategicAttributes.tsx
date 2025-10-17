import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationValues } from '@/hooks/useOrganizationValues';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export type StrategicAttributeType = 
  | 'growth_mindset'
  | 'root_cause_problem_solving'
  | 'teamwork'
  | 'quality'
  | 'proactive_documentation'
  | 'safety_focus'
  | 'efficiency'
  | 'asset_stewardship'
  | 'financial_impact'
  | 'energy_morale_impact';

export interface StrategicAttribute {
  id: string;
  user_id: string;
  attribute_type: StrategicAttributeType;
  level: number;
  earned_at: string;
  created_at: string;
  updated_at: string;
}

export interface AttributeAnalytics {
  userId: string;
  userName: string;
  userRole: string;
  attributes: Record<StrategicAttributeType, number>;
}

export interface CompanyAverage {
  attributes: Record<StrategicAttributeType, number>;
}

export const strategicAttributeLabels: Record<StrategicAttributeType, string> = {
  growth_mindset: 'Growth Mindset',
  root_cause_problem_solving: 'Root Cause Problem Solving',
  teamwork: 'Teamwork',
  quality: 'Quality',
  proactive_documentation: 'Proactive Documentation',
  safety_focus: 'Safety Focus',
  efficiency: 'Efficiency',
  asset_stewardship: 'Asset Stewardship',
  financial_impact: 'Financial Impact',
  energy_morale_impact: 'Energy & Morale Impact'
};

export function useStrategicAttributes() {
  const [attributes, setAttributes] = useState<StrategicAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { getOrganizationValues } = useOrganizationValues();
  const organizationId = useOrganizationId();

  const fetchAttributes = async (userIds?: string[], startDate?: string, endDate?: string) => {
    if (!organizationId) return;
    try {
      setIsLoading(true);
      
      // First, get strategic attributes
      let query = supabase
        .from('worker_strategic_attributes')
        .select('*')
        .order('attribute_type');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      if (startDate) {
        query = query.gte('earned_at', startDate);
      }

      if (endDate) {
        query = query.lte('earned_at', endDate);
      }

      const { data: attributesData, error: attributesError } = await query;
      if (attributesError) throw attributesError;

      // Then, get all unique user IDs from attributes
      const userIdsFromAttributes = [...new Set(attributesData?.map(attr => attr.user_id) || [])];
      
      // Fetch profiles for these users
      let profilesQuery = supabase
        .from('organization_members')
        .select('user_id, full_name, role')
        .in('user_id', userIdsFromAttributes);

      if (organizationId) {
        profilesQuery = profilesQuery.eq('organization_id', organizationId);
      }

      const { data: profilesData, error: profilesError } = await profilesQuery;

      if (profilesError) {
        console.warn('Error fetching profiles, continuing without profile data:', profilesError);
      }

      // Create a map of profiles for easy lookup
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      // Combine attributes with profile data
      const enrichedAttributes = attributesData?.map(attr => ({
        ...attr,
        profiles: profilesMap.get(attr.user_id) || {
          full_name: 'Unknown User',
          role: 'user'
        }
      })) || [];

      setAttributes(enrichedAttributes);
    } catch (error) {
      console.error('Error fetching strategic attributes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch strategic attributes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getAttributeAnalytics = async (userIds?: string[], filterByOrgValues = true): Promise<AttributeAnalytics[]> => {
    const userMap = new Map<string, AttributeAnalytics>();

    // Use all predefined strategic attributes for now (custom org values don't map to these enums)
    const attributesToUse = [
      'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
      'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
      'financial_impact', 'energy_morale_impact'
    ] as StrategicAttributeType[];

    attributes.forEach(attr => {
      if (userIds && userIds.length > 0 && !userIds.includes(attr.user_id)) return;

      if (!userMap.has(attr.user_id)) {
        userMap.set(attr.user_id, {
          userId: attr.user_id,
          userName: (attr as any).profiles?.full_name || 'Unknown User',
          userRole: (attr as any).profiles?.role || 'user',
          attributes: {} as Record<StrategicAttributeType, number>
        });
      }

      const userAnalytics = userMap.get(attr.user_id)!;
      userAnalytics.attributes[attr.attribute_type] = attr.level;
    });

    // Fill in missing attributes with 0 for organization-selected attributes only
    userMap.forEach(userAnalytics => {
      attributesToUse.forEach(type => {
        if (!(type in userAnalytics.attributes)) {
          userAnalytics.attributes[type] = 0;
        }
      });
    });

    return Array.from(userMap.values());
  };

  const getCompanyAverage = async (userIds?: string[], filterByOrgValues = true): Promise<CompanyAverage> => {
    const userAnalytics = await getAttributeAnalytics(userIds, false); // Don't filter by org values for now
    const averages: Record<StrategicAttributeType, number> = {} as Record<StrategicAttributeType, number>;

    // Use all predefined strategic attributes for now
    const attributesToUse = [
      'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
      'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
      'financial_impact', 'energy_morale_impact'
    ] as StrategicAttributeType[];

    attributesToUse.forEach(type => {
      const sum = userAnalytics.reduce((acc, user) => acc + (user.attributes[type] || 0), 0);
      averages[type] = userAnalytics.length > 0 ? sum / userAnalytics.length : 0;
    });

    return { attributes: averages };
  };

  useEffect(() => {
    if (organizationId) {
      fetchAttributes();
    }
  }, [organizationId]);

  return {
    attributes,
    isLoading,
    fetchAttributes,
    getAttributeAnalytics,
    getCompanyAverage
  };
}