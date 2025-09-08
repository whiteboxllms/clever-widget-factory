import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export interface ScoringPrompt {
  id: string;
  name: string;
  prompt_text: string;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useScoringPrompts = () => {
  const organizationId = useOrganizationId();
  const [prompts, setPrompts] = useState<ScoringPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPrompts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('scoring_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch scoring prompts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createPrompt = async (promptData: Partial<ScoringPrompt>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('scoring_prompts')
        .insert({
          name: promptData.name,
          prompt_text: promptData.prompt_text,
          is_default: promptData.is_default || false,
          created_by: user.id
        } as any)
        .select()
        .single();

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Scoring prompt created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to create scoring prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updatePrompt = async (id: string, updates: Partial<ScoringPrompt>) => {
    try {
      const { error } = await supabase
        .from('scoring_prompts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Scoring prompt updated successfully",
      });
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to update scoring prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const setDefaultPrompt = async (id: string) => {
    try {
      // First, remove default from all prompts
      await supabase
        .from('scoring_prompts')
        .update({ is_default: false })
        .neq('id', id);

      // Then set the selected prompt as default
      const { error } = await supabase
        .from('scoring_prompts')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Default prompt updated successfully",
      });
    } catch (error) {
      console.error('Error setting default prompt:', error);
      toast({
        title: "Error",
        description: "Failed to set default prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getDefaultPrompt = () => {
    return prompts.find(prompt => prompt.is_default) || prompts[0];
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  return {
    prompts,
    isLoading,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    setDefaultPrompt,
    getDefaultPrompt,
  };
};