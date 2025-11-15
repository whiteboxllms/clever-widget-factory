import { useState, useEffect } from 'react';
import { supabase } from '@/lib/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export type AttributeType = 
  | 'communication' 
  | 'quality' 
  | 'transparency' 
  | 'reliability'
  | 'mechanical' 
  | 'electrical' 
  | 'it' 
  | 'carpentry' 
  | 'plumbing'
  | 'hydraulics' 
  | 'welding' 
  | 'fabrication';

export interface WorkerAttribute {
  id: string;
  user_id: string;
  attribute_type: AttributeType;
  level: number;
  earned_at: string;
  created_at: string;
  updated_at: string;
}

export interface IssueRequirement {
  id: string;
  issue_id: string;
  attribute_type: AttributeType;
  required_level: number;
  created_at: string;
}

export interface WorkerPerformance {
  id: string;
  user_id: string;
  issue_id: string;
  outcome: 'successful' | 'failed' | 'escalated' | 'incomplete';
  attributes_used: AttributeType[];
  level_at_completion: number;
  completion_notes: string;
  supervisor_notes: string;
  hours_worked: number;
  completed_at: string;
  created_at: string;
}

export function useWorkerAttributes() {
  const organizationId = useOrganizationId();
  const [attributes, setAttributes] = useState<WorkerAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAttributes = async (userId?: string) => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('worker_attributes')
        .select('*')
        .order('attribute_type');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAttributes(data || []);
    } catch (error) {
      console.error('Error fetching worker attributes:', error);
      toast({
        title: "Error",
        description: "Failed to fetch worker attributes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateAttributeLevel = async (userId: string, attributeType: AttributeType, newLevel: number) => {
    try {
      const { error } = await supabase
        .from('worker_attributes')
        .upsert({
          user_id: userId,
          attribute_type: attributeType,
          level: newLevel,
          earned_at: new Date().toISOString()
        } as any);

      if (error) throw error;

      await fetchAttributes();
      toast({
        title: "Success",
        description: `${attributeType} level updated to ${newLevel}`,
      });
    } catch (error) {
      console.error('Error updating attribute level:', error);
      toast({
        title: "Error",
        description: "Failed to update attribute level",
        variant: "destructive",
      });
    }
  };

  const getWorkerQualifications = (userId: string): Record<AttributeType, number> => {
    const userAttributes = attributes.filter(attr => attr.user_id === userId);
    const qualifications: Record<string, number> = {};
    
    userAttributes.forEach(attr => {
      qualifications[attr.attribute_type] = attr.level;
    });

    // Fill in missing attributes with level 0
    const allAttributeTypes: AttributeType[] = [
      'communication', 'quality', 'transparency', 'reliability',
      'mechanical', 'electrical', 'it', 'carpentry', 'plumbing',
      'hydraulics', 'welding', 'fabrication'
    ];

    allAttributeTypes.forEach(type => {
      if (!(type in qualifications)) {
        qualifications[type] = 0;
      }
    });

    return qualifications as Record<AttributeType, number>;
  };

  const checkQualification = (userId: string, requirements: { attribute_type: AttributeType; required_level: number }[]): boolean => {
    const qualifications = getWorkerQualifications(userId);
    
    return requirements.every(req => 
      qualifications[req.attribute_type] >= req.required_level
    );
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  return {
    attributes,
    isLoading,
    fetchAttributes,
    updateAttributeLevel,
    getWorkerQualifications,
    checkQualification
  };
}

export function useIssueRequirements(issueId: string | null) {
  const organizationId = useOrganizationId();
  const [requirements, setRequirements] = useState<IssueRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchRequirements = async () => {
    if (!issueId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('issue_requirements')
        .select('*')
        .eq('issue_id', issueId);

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error fetching issue requirements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addRequirement = async (attributeType: AttributeType, requiredLevel: number) => {
    if (!issueId) return;

    try {
      const { error } = await supabase
        .from('issue_requirements')
        .insert({
          issue_id: issueId,
          attribute_type: attributeType,
          required_level: requiredLevel
        } as any);

      if (error) throw error;
      await fetchRequirements();
    } catch (error) {
      console.error('Error adding requirement:', error);
      toast({
        title: "Error",
        description: "Failed to add requirement",
        variant: "destructive",
      });
    }
  };

  const removeRequirement = async (requirementId: string) => {
    try {
      const { error } = await supabase
        .from('issue_requirements')
        .delete()
        .eq('id', requirementId);

      if (error) throw error;
      await fetchRequirements();
    } catch (error) {
      console.error('Error removing requirement:', error);
      toast({
        title: "Error",
        description: "Failed to remove requirement",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [issueId]);

  return {
    requirements,
    isLoading,
    fetchRequirements,
    addRequirement,
    removeRequirement
  };
}