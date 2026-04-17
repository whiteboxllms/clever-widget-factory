import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Loader2, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiService } from '@/lib/apiService';
import { capabilityProfileQueryKey, organizationCapabilityQueryKey } from '@/lib/queryKeys';
import { useOrganizationCapability } from '@/hooks/useCapability';
import { SkillRadarChart } from '@/components/RadarChart';
import { AxisDrilldown } from '@/components/AxisDrilldown';
import type { BaseAction } from '@/types/actions';
import type { SkillProfile } from '@/hooks/useSkillProfile';
import type { CapabilityProfile } from '@/hooks/useCapability';

const LOADING_TIMEOUT_MS = 30_000;

export interface CapabilityAssessmentProps {
  action: BaseAction;
}

/**
 * Container component that fetches capability profiles for all involved people
 * and the organization, then renders the radar chart with drilldown support.
 *
 * Requirements: 3.1, 4.1, 4.7, 6.1, 6.2
 */
export function CapabilityAssessment({ action }: CapabilityAssessmentProps) {
  const [selectedAxis, setSelectedAxis] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Check if the action has an approved skill profile
  const hasApprovedSkillProfile = !!action.skill_profile?.approved_at;
  const skillProfile = action.skill_profile as SkillProfile | null | undefined;

  // Collect all involved user IDs: assigned_to + participants
  const involvedUserIds = useMemo(() => {
    const ids: string[] = [];
    if (action.assigned_to) {
      ids.push(action.assigned_to);
    }
    if (action.participants?.length) {
      for (const pid of action.participants) {
        if (!ids.includes(pid)) {
          ids.push(pid);
        }
      }
    }
    return ids;
  }, [action.assigned_to, action.participants]);

  // Fetch capability profiles for all involved users using useQueries
  const capabilityQueries = useQueries({
    queries: involvedUserIds.map((userId) => ({
      queryKey: capabilityProfileQueryKey(action.id, userId),
      queryFn: async () => {
        const result = await apiService.get<{ data: CapabilityProfile }>(
          `/capability/${action.id}/${userId}`
        );
        return result.data;
      },
      enabled: hasApprovedSkillProfile,
      staleTime: 60_000,
    })),
  });

  // Fetch organization capability
  const orgQuery = useOrganizationCapability(
    action.id,
    hasApprovedSkillProfile
  );

  // Derive loading / error states from all queries
  const isLoading =
    capabilityQueries.some((q) => q.isLoading) || orgQuery.isLoading;
  const hasError =
    capabilityQueries.some((q) => q.isError) || orgQuery.isError;

  // 30-second loading timeout
  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Retry all failed queries
  const handleRetry = useCallback(() => {
    setTimedOut(false);
    capabilityQueries.forEach((q) => {
      if (q.isError) q.refetch();
    });
    if (orgQuery.isError) orgQuery.refetch();
  }, [capabilityQueries, orgQuery]);

  // Collect successful capability profiles
  const capabilityProfiles = useMemo(
    () =>
      capabilityQueries
        .filter((q) => q.isSuccess && q.data)
        .map((q) => q.data as CapabilityProfile),
    [capabilityQueries]
  );

  const organizationProfile = orgQuery.data ?? undefined;

  // --- Empty state: no approved skill profile ---
  if (!hasApprovedSkillProfile || !skillProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No skill profile available. Generate and approve a skill profile to see the growth checklist.
        </p>
      </div>
    );
  }

  // --- Loading state ---
  if (isLoading && !timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Loading growth checklist…</p>
      </div>
    );
  }

  // --- Timeout state ---
  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Loading growth checklist is taking longer than expected.
        </p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // --- Error state ---
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Unable to load growth checklist. Please try again.
        </p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // --- Radar chart + drilldown ---
  return (
    <div className="space-y-2">
      <SkillRadarChart
        skillProfile={skillProfile}
        capabilityProfiles={capabilityProfiles}
        organizationProfile={organizationProfile}
        onAxisClick={(axisKey) => setSelectedAxis(axisKey)}
      />

      {selectedAxis && (
        <AxisDrilldown
          axisKey={selectedAxis}
          skillProfile={skillProfile}
          capabilityProfiles={capabilityProfiles}
          organizationProfile={organizationProfile}
          isOpen={!!selectedAxis}
          onClose={() => setSelectedAxis(null)}
        />
      )}
    </div>
  );
}
