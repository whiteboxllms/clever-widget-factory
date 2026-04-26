/**
 * AiConfigCard Component
 *
 * Displays and manages per-organization AI configuration parameters:
 * - Max axes per skill profile (integer 1-6)
 * - Evidence limit per axis (integer 1-10)
 * - Quiz generation temperature (decimal 0.0-1.0)
 *
 * Uses React Hook Form + Zod for validation, TanStack Query for
 * data fetching and optimistic mutations.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5, 5.7, 5.8, 5.9
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiService, getApiData } from '@/lib/apiService';
import { Loader2, Settings2 } from 'lucide-react';

// --- Types ---

interface AiConfig {
  max_axes: number;
  min_axes: number;
  evidence_limit: number;
  quiz_temperature: number;
}

interface AiConfigCardProps {
  organizationId: string;
}

// --- Defaults (match backend AI_CONFIG_DEFAULTS) ---

const AI_CONFIG_DEFAULTS: AiConfig = {
  max_axes: 3,
  min_axes: 2,
  evidence_limit: 3,
  quiz_temperature: 0.7,
};

// --- Zod schema matching backend validation bounds ---

const aiConfigSchema = z.object({
  max_axes: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Minimum is 1')
    .max(6, 'Maximum is 6'),
  evidence_limit: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Minimum is 1')
    .max(10, 'Maximum is 10'),
  quiz_temperature: z
    .number()
    .min(0.0, 'Minimum is 0.0')
    .max(1.0, 'Maximum is 1.0'),
});

type AiConfigFormData = z.infer<typeof aiConfigSchema>;

// --- Query key ---

function aiConfigQueryKey(organizationId: string) {
  return ['ai-config', organizationId];
}

// --- Component ---

export function AiConfigCard({ organizationId }: AiConfigCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current config
  const {
    data: config,
    isLoading,
    isError,
    error,
  } = useQuery<AiConfig>({
    queryKey: aiConfigQueryKey(organizationId),
    queryFn: async () => {
      const response = await apiService.get(
        `/organizations/${organizationId}/ai-config`
      );
      return getApiData(response) ?? AI_CONFIG_DEFAULTS;
    },
    enabled: !!organizationId,
  });

  // Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<AiConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: {
      max_axes: AI_CONFIG_DEFAULTS.max_axes,
      evidence_limit: AI_CONFIG_DEFAULTS.evidence_limit,
      quiz_temperature: AI_CONFIG_DEFAULTS.quiz_temperature,
    },
  });

  // Sync form when config loads
  useEffect(() => {
    if (config) {
      reset({
        max_axes: config.max_axes,
        evidence_limit: config.evidence_limit,
        quiz_temperature: config.quiz_temperature,
      });
    }
  }, [config, reset]);

  // Save mutation with optimistic update
  const saveMutation = useMutation({
    mutationFn: async (data: AiConfigFormData) => {
      const response = await apiService.put(
        `/organizations/${organizationId}/ai-config`,
        data
      );
      return getApiData(response) as AiConfig;
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: aiConfigQueryKey(organizationId),
      });

      // Snapshot previous value
      const previousConfig = queryClient.getQueryData<AiConfig>(
        aiConfigQueryKey(organizationId)
      );

      // Optimistically update cache
      queryClient.setQueryData<AiConfig>(
        aiConfigQueryKey(organizationId),
        (old) => ({
          ...(old ?? AI_CONFIG_DEFAULTS),
          ...newData,
        })
      );

      return { previousConfig };
    },
    onError: (_err, _newData, context) => {
      // Rollback on error
      if (context?.previousConfig) {
        queryClient.setQueryData(
          aiConfigQueryKey(organizationId),
          context.previousConfig
        );
      }
      toast({
        title: 'Error',
        description: 'Failed to save AI configuration. Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: (savedConfig) => {
      // Update cache with server response
      queryClient.setQueryData(
        aiConfigQueryKey(organizationId),
        savedConfig
      );
      toast({
        title: 'Saved',
        description: 'AI configuration updated successfully.',
      });
    },
  });

  const onSubmit = (data: AiConfigFormData) => {
    saveMutation.mutate(data);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            AI Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load AI configuration: {(error as Error)?.message || 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          AI Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Configure AI parameters for skill profile generation, evidence retrieval, and quiz scoring.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Max Axes */}
            <div className="space-y-2">
              <Label htmlFor="max_axes">Max Axes per Profile</Label>
              <Input
                id="max_axes"
                type="number"
                min={1}
                max={6}
                step={1}
                {...register('max_axes', { valueAsNumber: true })}
              />
              {errors.max_axes && (
                <p className="text-xs text-destructive">{errors.max_axes.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Integer 1–6 (default: 3)</p>
            </div>

            {/* Evidence Limit */}
            <div className="space-y-2">
              <Label htmlFor="evidence_limit">Evidence Limit per Axis</Label>
              <Input
                id="evidence_limit"
                type="number"
                min={1}
                max={10}
                step={1}
                {...register('evidence_limit', { valueAsNumber: true })}
              />
              {errors.evidence_limit && (
                <p className="text-xs text-destructive">{errors.evidence_limit.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Integer 1–10 (default: 3)</p>
            </div>

            {/* Quiz Temperature */}
            <div className="space-y-2">
              <Label htmlFor="quiz_temperature">Quiz Temperature</Label>
              <Input
                id="quiz_temperature"
                type="number"
                min={0}
                max={1}
                step={0.1}
                {...register('quiz_temperature', { valueAsNumber: true })}
              />
              {errors.quiz_temperature && (
                <p className="text-xs text-destructive">{errors.quiz_temperature.message}</p>
              )}
              <p className="text-xs text-muted-foreground">Decimal 0.0–1.0 (default: 0.7)</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty || isSubmitting || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
