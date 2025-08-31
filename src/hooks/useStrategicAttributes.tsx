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
      let query = supabase
        .from('worker_strategic_attributes')
        .select(`
          *,
          profiles!worker_strategic_attributes_user_id_fkey (
            full_name,
            role
          )
        `)
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

      const { data, error } = await query;

      if (error) throw error;
      setAttributes(data || []);
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
      if (userIds && !userIds.includes(attr.user_id)) return;

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