import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const fetchAttributes = async (userIds?: string[], startDate?: string, endDate?: string) => {
    try {
      setIsLoading(true);
      
      // First, get strategic attributes
      let query = supabase
        .from('worker_strategic_attributes')
        .select('*')
        .order('attribute_type');

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
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('user_id', userIdsFromAttributes);

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

  const getAttributeAnalytics = (userIds?: string[]): AttributeAnalytics[] => {
    const userMap = new Map<string, AttributeAnalytics>();

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

    // Fill in missing attributes with 0
    const allAttributeTypes: StrategicAttributeType[] = [
      'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
      'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
      'financial_impact', 'energy_morale_impact'
    ];

    userMap.forEach(userAnalytics => {
      allAttributeTypes.forEach(type => {
        if (!(type in userAnalytics.attributes)) {
          userAnalytics.attributes[type] = 0;
        }
      });
    });

    return Array.from(userMap.values());
  };

  const getCompanyAverage = (userIds?: string[]): CompanyAverage => {
    const userAnalytics = getAttributeAnalytics(userIds);
    const averages: Record<StrategicAttributeType, number> = {} as Record<StrategicAttributeType, number>;

    const allAttributeTypes: StrategicAttributeType[] = [
      'growth_mindset', 'root_cause_problem_solving', 'teamwork', 'quality',
      'proactive_documentation', 'safety_focus', 'efficiency', 'asset_stewardship',
      'financial_impact', 'energy_morale_impact'
    ];

    allAttributeTypes.forEach(type => {
      const sum = userAnalytics.reduce((acc, user) => acc + user.attributes[type], 0);
      averages[type] = userAnalytics.length > 0 ? sum / userAnalytics.length : 0;
    });

    return { attributes: averages };
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  return {
    attributes,
    isLoading,
    fetchAttributes,
    getAttributeAnalytics,
    getCompanyAverage
  };
}