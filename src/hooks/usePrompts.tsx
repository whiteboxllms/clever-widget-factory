import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { Prompt, ValidationResult } from '@/types/report';
import { validateResponse } from '@/services/responseValidator';

export const usePrompts = () => {
  const organizationId = useOrganizationId();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPrompts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch prompts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPromptsByUsage = async (intendedUsage: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('intended_usage', intendedUsage)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching prompts by usage:', error);
      toast({
        title: "Error",
        description: `Failed to fetch ${intendedUsage} prompts`,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const createPrompt = async (promptData: Partial<Prompt>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('prompts')
        .insert({
          name: promptData.name,
          prompt_text: promptData.prompt_text,
          intended_usage: promptData.intended_usage || 'scoring',
          expected_response_json: promptData.expected_response_json,
          is_default: promptData.is_default || false,
          created_by: user.id
        } as any)
        .select()
        .single();

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Prompt created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to create prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updatePrompt = async (id: string, updates: Partial<Prompt>) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Prompt updated successfully",
      });
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast({
        title: "Error",
        description: "Failed to update prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deletePrompt = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchPrompts();
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
      throw error;
    }
  };

  const setDefaultPrompt = async (id: string) => {
    try {
      // First, remove default from all prompts of the same usage type
      const prompt = prompts.find(p => p.id === id);
      if (!prompt) throw new Error('Prompt not found');

      await supabase
        .from('prompts')
        .update({ is_default: false })
        .eq('intended_usage', prompt.intended_usage)
        .neq('id', id);

      // Then set the selected prompt as default
      const { error } = await supabase
        .from('prompts')
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

  const getDefaultPrompt = (intendedUsage?: string) => {
    const filteredPrompts = intendedUsage 
      ? prompts.filter(p => p.intended_usage === intendedUsage)
      : prompts;
    return filteredPrompts.find(prompt => prompt.is_default) || filteredPrompts[0];
  };

  const validatePromptResponse = async (promptId: string, response: any): Promise<ValidationResult> => {
    try {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) {
        return {
          isValid: false,
          errors: ['Prompt not found'],
          warnings: []
        };
      }

      if (!prompt.expected_response_json) {
        return {
          isValid: true,
          errors: [],
          warnings: ['No validation schema provided for this prompt']
        };
      }

      return validateResponse(response, prompt.expected_response_json);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  };

  const getReportGenerationPrompts = () => {
    return prompts.filter(p => p.intended_usage === 'report_generation');
  };

  const getScoringPrompts = () => {
    return prompts.filter(p => p.intended_usage === 'scoring');
  };

  const getImageCaptioningPrompts = () => {
    return prompts.filter(p => p.intended_usage === 'image_captioning');
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  return {
    prompts,
    isLoading,
    fetchPrompts,
    fetchPromptsByUsage,
    createPrompt,
    updatePrompt,
    deletePrompt,
    setDefaultPrompt,
    getDefaultPrompt,
    validatePromptResponse,
    getReportGenerationPrompts,
    getScoringPrompts,
    getImageCaptioningPrompts,
  };
};
