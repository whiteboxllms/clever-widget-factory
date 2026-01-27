import { apiService } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { getCurrentUser } from 'aws-amplify/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';

export interface ScoringPrompt {
  id: string;
  name: string;
  prompt_text: string;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Query key factory
export const scoringPromptsQueryKey = () => ['scoring_prompts'];

export const useScoringPrompts = () => {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Use TanStack Query for caching
  const { data: prompts = [], isLoading } = useQuery({
    queryKey: scoringPromptsQueryKey(),
    queryFn: async () => {
      const response = await apiService.get('/scoring_prompts');
      return response.data || [];
    },
    ...offlineQueryConfig,
  });

  const fetchPrompts = async () => {
    await queryClient.invalidateQueries({ queryKey: scoringPromptsQueryKey() });
  };

  const createPrompt = async (promptData: Partial<ScoringPrompt>) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('User not authenticated');

      const response = await apiService.post('/scoring_prompts', {
        name: promptData.name,
        prompt_text: promptData.prompt_text,
        is_default: promptData.is_default || false,
        created_by: user.userId
      });
      const data = response.data;

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: scoringPromptsQueryKey() });
      
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
      await apiService.put(`/scoring_prompts/${id}`, updates);

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: scoringPromptsQueryKey() });
      
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
      await apiService.put(`/scoring_prompts/${id}/set-default`, {});

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: scoringPromptsQueryKey() });
      
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