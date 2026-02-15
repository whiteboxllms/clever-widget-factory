import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createExperience, listExperiences, getExperience } from '@/lib/apiService';
import { experiencesQueryKey, experienceQueryKey } from '@/lib/queryKeys';
import type { 
  CreateExperienceRequest, 
  ExperienceListParams 
} from '@/types/experiences';

/**
 * Query hook to list experiences with optional filters
 * @param params - Optional filters (entity_type, entity_id, limit, offset)
 */
export function useExperiences(params?: ExperienceListParams) {
  return useQuery({
    queryKey: experiencesQueryKey(params),
    queryFn: () => listExperiences(params),
    enabled: !!(params?.entity_type && params?.entity_id),
  });
}

/**
 * Query hook to get a single experience by ID
 * @param experienceId - The experience ID to fetch
 */
export function useExperience(experienceId: string) {
  return useQuery({
    queryKey: experienceQueryKey(experienceId),
    queryFn: () => getExperience(experienceId),
    enabled: !!experienceId,
  });
}

/**
 * Mutation hook to create a new experience
 * Automatically invalidates relevant queries on success
 */
export function useCreateExperience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExperienceRequest) => createExperience(data),
    onSuccess: (_, variables) => {
      // Invalidate the general experiences list
      queryClient.invalidateQueries({ queryKey: experiencesQueryKey() });
      
      // Invalidate the entity-specific experiences list
      queryClient.invalidateQueries({ 
        queryKey: experiencesQueryKey({ 
          entity_type: variables.entity_type, 
          entity_id: variables.entity_id 
        }) 
      });
    },
  });
}
