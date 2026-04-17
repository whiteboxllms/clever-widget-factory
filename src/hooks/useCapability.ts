import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/lib/apiService';
import { capabilityProfileQueryKey, organizationCapabilityQueryKey } from '@/lib/queryKeys';

// Capability profile types matching the design document schema

export interface ObservationEvidence {
  observation_id: string;
  action_id: string;
  action_title: string;
  text_excerpt: string;
  photo_urls: string[];
  captured_at: string;
  relevance_score: number;
}

export interface CapabilityAxis {
  key: string;
  label: string;
  level: number;
  evidence_count: number;
  evidence: ObservationEvidence[];
}

export interface CapabilityProfile {
  user_id: string;
  user_name: string;
  action_id: string;
  narrative: string;
  axes: CapabilityAxis[];
  total_evidence_count: number;
  computed_at: string;
}

/**
 * Query hook to fetch a person's capability profile relative to an action.
 * GET /api/capability/:actionId/:userId
 * Only enabled when both IDs are provided and the action has an approved skill profile.
 * Requirements: 3.1
 */
export function useCapabilityProfile(
  actionId: string | undefined,
  userId: string | undefined,
  hasApprovedSkillProfile: boolean = false
) {
  return useQuery({
    queryKey: capabilityProfileQueryKey(actionId!, userId!),
    queryFn: async () => {
      const result = await apiService.get<{ data: CapabilityProfile }>(
        `/capability/${actionId}/${userId}`
      );
      return result.data;
    },
    enabled: !!(actionId && userId && hasApprovedSkillProfile),
    staleTime: 60000, // 1 minute — capability profiles are computed on-demand
  });
}

/**
 * Query hook to fetch the organization's capability profile for an action.
 * GET /api/capability/:actionId/organization
 * Only enabled when actionId is provided and the action has an approved skill profile.
 * Requirements: 6.1
 */
export function useOrganizationCapability(
  actionId: string | undefined,
  hasApprovedSkillProfile: boolean = false
) {
  return useQuery({
    queryKey: organizationCapabilityQueryKey(actionId!),
    queryFn: async () => {
      const result = await apiService.get<{ data: CapabilityProfile }>(
        `/capability/${actionId}/organization`
      );
      return result.data;
    },
    enabled: !!(actionId && hasApprovedSkillProfile),
    staleTime: 60000, // 1 minute — capability profiles are computed on-demand
  });
}
