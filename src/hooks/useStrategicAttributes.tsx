import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useCognitoAuth';
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
  attributeType: StrategicAttributeType;
  level: number;
  earnedAt: string;
}

export interface CompanyAverage {
  attributeType: StrategicAttributeType;
  averageLevel: number;
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
  energy_morale_impact: 'Energy & Morale Impact',
};

export function useStrategicAttributes() {
  const [attributes, setAttributes] = useState<StrategicAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchAttributes = async () => {
    if (!user?.userId) {
      console.log('No user ID, skipping fetch');
      return;
    }
    
    console.log('Fetching strategic attributes for organization');
    setLoading(true);
    try {
      // Fetch ALL strategic attributes (for analytics dashboard)
      const { data, error } = await supabase
        .from('worker_strategic_attributes')
        .select('*');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Strategic attributes fetched:', data);
      setAttributes(data || []);
    } catch (error) {
      console.error('Error fetching strategic attributes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch strategic attributes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, [user?.userId]);

  return {
    attributes,
    loading,
    fetchAttributes,
  };
}
