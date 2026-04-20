/**
 * LensManagementCard Component
 *
 * Manages per-organization lens configuration for quiz diversity:
 * - System Lenses: 6 built-in lenses with weight/enabled controls
 * - Values Lenses: auto-derived from strategic attributes
 * - Custom Lenses: org-defined lenses with add/edit/delete
 * - Gap Boost Rules: capability gap → lens weight multiplier rules
 *
 * Uses React Hook Form + Zod for validation, TanStack Query for
 * data fetching and optimistic mutations.
 *
 * Requirements: 9.1–9.10, 3.2–3.6, 5.1, 5.2
 */

import { useEffect, useState, useMemo } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectItem,
} from '@/components/ui/multi-select';
import { useToast } from '@/hooks/use-toast';
import { apiService, getApiData } from '@/lib/apiService';
import {
  Loader2,
  Glasses,
  Plus,
  Trash2,
  Pencil,
  Info,
  X,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// System Lens Definitions (mirrors lambda/shared/lensDefaults.js)
// ---------------------------------------------------------------------------

const SYSTEM_LENSES = [
  { key: 'failure_analysis', label: 'Failure Analysis', description: 'What could go wrong if this practice is done incorrectly or skipped?', defaultWeight: 0.5 },
  { key: 'underlying_science', label: 'Underlying Science', description: 'What physics, chemistry, or biology principles explain why this practice works?', defaultWeight: 0.5 },
  { key: 'cross_asset_comparison', label: 'Cross-Asset Comparison', description: 'How does this compare or contrast with related farm work, tools, or processes?', defaultWeight: 0.5 },
  { key: 'practical_tradeoffs', label: 'Practical Tradeoffs', description: 'What are the time, cost, and effort tradeoffs of different approaches?', defaultWeight: 0.5 },
  { key: 'root_cause_reasoning', label: 'Root Cause Reasoning', description: 'Why does this happen at a fundamental level? What is the root cause?', defaultWeight: 0.5 },
  { key: 'scenario_response', label: 'Scenario Response', description: 'Here is a situation — describe what you would do and why.', defaultWeight: 0.5 },
] as const;

const LENS_CONFIG_DEFAULTS = {
  system_lens_weights: {} as Record<string, { weight: number; enabled: boolean }>,
  custom_lenses: [] as CustomLens[],
  values_lens_weights: {} as Record<string, { weight: number; enabled: boolean }>,
  gap_boost_rules: [] as GapBoostRule[],
};

const VALUES_LENS_DEFAULT_WEIGHT = 0.3;
const MAX_CUSTOM_LENSES = 20;
const MAX_GAP_BOOST_RULES = 10;


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomLens {
  key: string;
  label: string;
  description: string;
  weight: number;
  enabled: boolean;
}

interface GapBoostRule {
  id: string;
  threshold: number;
  lens_keys: string[];
  multiplier: number;
}

interface LensConfig {
  system_lens_weights: Record<string, { weight: number; enabled: boolean }>;
  custom_lenses: CustomLens[];
  values_lens_weights: Record<string, { weight: number; enabled: boolean }>;
  gap_boost_rules: GapBoostRule[];
}

interface LensManagementCardProps {
  organizationId: string;
  strategicAttributes: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function roundWeight(val: number): number {
  return Math.round(val * 10) / 10;
}

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const weightEntrySchema = z.object({
  weight: z.number().min(0.0, 'Min 0.0').max(1.0, 'Max 1.0'),
  enabled: z.boolean(),
});

const customLensSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1, 'Label required').max(100, 'Max 100 characters'),
  description: z.string().min(1, 'Description required').max(500, 'Max 500 characters'),
  weight: z.number().min(0.0, 'Min 0.0').max(1.0, 'Max 1.0'),
  enabled: z.boolean(),
});

const gapBoostRuleSchema = z.object({
  id: z.string().min(1),
  threshold: z.number().min(0.5, 'Min 0.5'),
  lens_keys: z.array(z.string()).min(1, 'Select at least one lens'),
  multiplier: z.number().min(1.1, 'Min 1.1').max(3.0, 'Max 3.0'),
});

const lensConfigSchema = z.object({
  system_lens_weights: z.record(z.string(), weightEntrySchema),
  custom_lenses: z.array(customLensSchema).max(MAX_CUSTOM_LENSES, `Max ${MAX_CUSTOM_LENSES} custom lenses`),
  values_lens_weights: z.record(z.string(), weightEntrySchema),
  gap_boost_rules: z.array(gapBoostRuleSchema).max(MAX_GAP_BOOST_RULES, `Max ${MAX_GAP_BOOST_RULES} rules`),
}).refine(
  (data) => {
    const labels = data.custom_lenses.map((l) => l.label.toLowerCase());
    return new Set(labels).size === labels.length;
  },
  { message: 'Custom lens labels must be unique', path: ['custom_lenses'] }
);

type LensConfigFormData = z.infer<typeof lensConfigSchema>;

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

function aiConfigQueryKey(organizationId: string) {
  return ['ai-config', organizationId];
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LensManagementCard({ organizationId, strategicAttributes }: LensManagementCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- Add custom lens form state ---
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomDescription, setNewCustomDescription] = useState('');
  const [newCustomWeight, setNewCustomWeight] = useState(0.5);
  const [customLabelError, setCustomLabelError] = useState('');

  // --- Edit custom lens state ---
  const [editingCustomIdx, setEditingCustomIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeight, setEditWeight] = useState(0.5);
  const [editLabelError, setEditLabelError] = useState('');

  // --- Add gap boost rule state ---
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleThreshold, setNewRuleThreshold] = useState(0.5);
  const [newRuleMultiplier, setNewRuleMultiplier] = useState(1.5);
  const [newRuleLensKeys, setNewRuleLensKeys] = useState<string[]>([]);

  // --- Fetch current config ---
  const {
    data: aiConfig,
    isLoading,
    isError,
    error,
  } = useQuery<any>({
    queryKey: aiConfigQueryKey(organizationId),
    queryFn: async () => {
      const response = await apiService.get(`/organizations/${organizationId}/ai-config`);
      return getApiData(response);
    },
    enabled: !!organizationId,
  });

  // Resolve lens config from ai_config, falling back to defaults
  const resolvedConfig = useMemo<LensConfig>(() => {
    const raw = aiConfig?.lens_config;
    if (!raw || typeof raw !== 'object') return { ...LENS_CONFIG_DEFAULTS };
    return {
      system_lens_weights: raw.system_lens_weights && typeof raw.system_lens_weights === 'object'
        ? raw.system_lens_weights : {},
      custom_lenses: Array.isArray(raw.custom_lenses) ? raw.custom_lenses : [],
      values_lens_weights: raw.values_lens_weights && typeof raw.values_lens_weights === 'object'
        ? raw.values_lens_weights : {},
      gap_boost_rules: Array.isArray(raw.gap_boost_rules) ? raw.gap_boost_rules : [],
    };
  }, [aiConfig]);

  // Build form default values from resolved config
  const formDefaults = useMemo<LensConfigFormData>(() => {
    // System lens weights — fill in defaults for all 6
    const systemWeights: Record<string, { weight: number; enabled: boolean }> = {};
    for (const lens of SYSTEM_LENSES) {
      const override = resolvedConfig.system_lens_weights[lens.key];
      systemWeights[lens.key] = {
        weight: override?.weight ?? lens.defaultWeight,
        enabled: override?.enabled ?? true,
      };
    }

    // Values lens weights — fill in defaults for current strategic attributes
    const valuesWeights: Record<string, { weight: number; enabled: boolean }> = {};
    for (const attr of strategicAttributes) {
      const key = `values_${slugify(attr)}`;
      const override = resolvedConfig.values_lens_weights[key];
      valuesWeights[key] = {
        weight: override?.weight ?? VALUES_LENS_DEFAULT_WEIGHT,
        enabled: override?.enabled ?? true,
      };
    }

    return {
      system_lens_weights: systemWeights,
      custom_lenses: resolvedConfig.custom_lenses,
      values_lens_weights: valuesWeights,
      gap_boost_rules: resolvedConfig.gap_boost_rules,
    };
  }, [resolvedConfig, strategicAttributes]);

  // --- Form setup ---
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<LensConfigFormData>({
    resolver: zodResolver(lensConfigSchema),
    defaultValues: formDefaults,
  });

  const { fields: customFields, append: appendCustom, remove: removeCustom, update: updateCustom } = useFieldArray({
    control,
    name: 'custom_lenses',
  });

  const { fields: ruleFields, append: appendRule, remove: removeRule } = useFieldArray({
    control,
    name: 'gap_boost_rules',
  });

  // Sync form when config loads or strategic attributes change
  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  // All available lens keys for gap boost rule target selection
  const allLensKeys = useMemo(() => {
    const keys: { key: string; label: string }[] = [];
    for (const lens of SYSTEM_LENSES) {
      keys.push({ key: lens.key, label: lens.label });
    }
    for (const attr of strategicAttributes) {
      const key = `values_${slugify(attr)}`;
      keys.push({ key, label: `${attr} (value)` });
    }
    const currentCustom = getValues('custom_lenses') || [];
    for (const cl of currentCustom) {
      keys.push({ key: cl.key, label: `${cl.label} (custom)` });
    }
    return keys;
  }, [strategicAttributes, customFields]);


  // --- Save mutation with optimistic update ---
  const saveMutation = useMutation({
    mutationFn: async (data: LensConfigFormData) => {
      const response = await apiService.put(
        `/organizations/${organizationId}/ai-config`,
        { lens_config: data }
      );
      return getApiData(response);
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: aiConfigQueryKey(organizationId) });
      const previousConfig = queryClient.getQueryData<any>(aiConfigQueryKey(organizationId));
      queryClient.setQueryData<any>(aiConfigQueryKey(organizationId), (old: any) => ({
        ...(old ?? {}),
        lens_config: newData,
      }));
      return { previousConfig };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(aiConfigQueryKey(organizationId), context.previousConfig);
      }
      toast({
        title: 'Error',
        description: 'Failed to save lens configuration. Please try again.',
        variant: 'destructive',
      });
    },
    onSuccess: (savedConfig) => {
      queryClient.setQueryData(aiConfigQueryKey(organizationId), savedConfig);
      toast({
        title: 'Saved',
        description: 'Lens configuration updated successfully.',
      });
    },
  });

  const onSubmit = (data: LensConfigFormData) => {
    saveMutation.mutate(data);
  };

  // --- Custom lens add handler ---
  const handleAddCustomLens = () => {
    setCustomLabelError('');
    if (!newCustomLabel.trim()) {
      setCustomLabelError('Label is required');
      return;
    }
    if (newCustomLabel.length > 100) {
      setCustomLabelError('Max 100 characters');
      return;
    }
    if (!newCustomDescription.trim()) {
      setCustomLabelError('Description is required');
      return;
    }
    if (newCustomDescription.length > 500) {
      setCustomLabelError('Description max 500 characters');
      return;
    }
    const currentCustom = getValues('custom_lenses') || [];
    if (currentCustom.length >= MAX_CUSTOM_LENSES) {
      setCustomLabelError(`Maximum ${MAX_CUSTOM_LENSES} custom lenses`);
      return;
    }
    const duplicate = currentCustom.some(
      (l) => l.label.toLowerCase() === newCustomLabel.trim().toLowerCase()
    );
    if (duplicate) {
      setCustomLabelError('A custom lens with this label already exists');
      return;
    }
    appendCustom({
      key: `custom_${slugify(newCustomLabel.trim())}`,
      label: newCustomLabel.trim(),
      description: newCustomDescription.trim(),
      weight: roundWeight(newCustomWeight),
      enabled: true,
    });
    setNewCustomLabel('');
    setNewCustomDescription('');
    setNewCustomWeight(0.5);
    setShowAddCustom(false);
  };

  // --- Custom lens edit handlers ---
  const startEditCustom = (idx: number) => {
    const lens = getValues(`custom_lenses.${idx}`);
    setEditingCustomIdx(idx);
    setEditLabel(lens.label);
    setEditDescription(lens.description);
    setEditWeight(lens.weight);
    setEditLabelError('');
  };

  const cancelEditCustom = () => {
    setEditingCustomIdx(null);
    setEditLabelError('');
  };

  const saveEditCustom = () => {
    if (editingCustomIdx === null) return;
    setEditLabelError('');
    if (!editLabel.trim()) {
      setEditLabelError('Label is required');
      return;
    }
    if (editLabel.length > 100) {
      setEditLabelError('Max 100 characters');
      return;
    }
    if (!editDescription.trim()) {
      setEditLabelError('Description is required');
      return;
    }
    if (editDescription.length > 500) {
      setEditLabelError('Description max 500 characters');
      return;
    }
    const currentCustom = getValues('custom_lenses') || [];
    const duplicate = currentCustom.some(
      (l, i) => i !== editingCustomIdx && l.label.toLowerCase() === editLabel.trim().toLowerCase()
    );
    if (duplicate) {
      setEditLabelError('A custom lens with this label already exists');
      return;
    }
    const existing = currentCustom[editingCustomIdx];
    updateCustom(editingCustomIdx, {
      key: existing.key,
      label: editLabel.trim(),
      description: editDescription.trim(),
      weight: roundWeight(editWeight),
      enabled: existing.enabled,
    });
    setEditingCustomIdx(null);
  };

  // --- Gap boost rule add handler ---
  const handleAddRule = () => {
    const currentRules = getValues('gap_boost_rules') || [];
    if (currentRules.length >= MAX_GAP_BOOST_RULES) return;
    if (newRuleLensKeys.length === 0) return;
    appendRule({
      id: `rule-${Date.now()}`,
      threshold: roundWeight(newRuleThreshold),
      lens_keys: newRuleLensKeys,
      multiplier: roundWeight(newRuleMultiplier),
    });
    setNewRuleThreshold(0.5);
    setNewRuleMultiplier(1.5);
    setNewRuleLensKeys([]);
    setShowAddRule(false);
  };


  // --- Loading state ---
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Question Lens Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading lens configuration...
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Error state ---
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Question Lens Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load lens configuration: {(error as Error)?.message || 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const watchedCustomLenses = watch('custom_lenses') || [];
  const watchedRules = watch('gap_boost_rules') || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Glasses className="w-5 h-5" />
          Question Lens Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-6">
          Configure question lenses that add diversity and depth to quiz generation by framing learning objectives from different angles.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* ============================================================= */}
          {/* SYSTEM LENSES SECTION                                         */}
          {/* ============================================================= */}
          <div>
            <h3 className="text-sm font-semibold mb-1">System Lenses</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Built-in lenses that ship with the platform. Adjust weights or disable individual lenses.
            </p>
            <div className="space-y-3">
              {SYSTEM_LENSES.map((lens) => (
                <div key={lens.key} className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{lens.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{lens.description}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Controller
                      control={control}
                      name={`system_lens_weights.${lens.key}.weight`}
                      render={({ field }) => {
                        const weight = field.value ?? lens.defaultWeight;
                        return (
                          <div className="flex items-center gap-2 w-48">
                            <Slider
                              min={0}
                              max={1}
                              step={0.1}
                              value={[weight]}
                              onValueChange={([val]) => field.onChange(roundWeight(val))}
                              className="flex-1"
                            />
                            <span className="text-xs font-mono w-8 text-right">{weight.toFixed(1)}</span>
                          </div>
                        );
                      }}
                    />
                    <Controller
                      control={control}
                      name={`system_lens_weights.${lens.key}.enabled`}
                      render={({ field }) => (
                        <Switch
                          checked={field.value ?? true}
                          onCheckedChange={field.onChange}
                          aria-label={`Enable ${lens.label}`}
                        />
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ============================================================= */}
          {/* VALUES LENSES SECTION                                         */}
          {/* ============================================================= */}
          <div>
            <h3 className="text-sm font-semibold mb-1">Values Lenses</h3>
            <div className="flex items-center gap-1.5 mb-3">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs text-muted-foreground">
                Auto-derived from your organization values. Add or remove values in the Organization Values section above.
              </p>
            </div>
            {strategicAttributes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3 border rounded-lg">
                No organization values configured. Add values above to generate values lenses.
              </p>
            ) : (
              <div className="space-y-3">
                {strategicAttributes.map((attr) => {
                  const key = `values_${slugify(attr)}`;
                  return (
                    <div key={key} className="flex items-center gap-4 p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {attr}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">value</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          How does this practice align with or reinforce the organization value: {attr}?
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Controller
                          control={control}
                          name={`values_lens_weights.${key}.weight`}
                          render={({ field }) => {
                            const weight = field.value ?? VALUES_LENS_DEFAULT_WEIGHT;
                            return (
                              <div className="flex items-center gap-2 w-48">
                                <Slider
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  value={[weight]}
                                  onValueChange={([val]) => field.onChange(roundWeight(val))}
                                  className="flex-1"
                                />
                                <span className="text-xs font-mono w-8 text-right">{weight.toFixed(1)}</span>
                              </div>
                            );
                          }}
                        />
                        <Controller
                          control={control}
                          name={`values_lens_weights.${key}.enabled`}
                          render={({ field }) => (
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                              aria-label={`Enable ${attr} lens`}
                            />
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* ============================================================= */}
          {/* CUSTOM LENSES SECTION                                         */}
          {/* ============================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">Custom Lenses</h3>
              <span className="text-xs text-muted-foreground">{watchedCustomLenses.length}/{MAX_CUSTOM_LENSES}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Organization-specific lenses for custom questioning angles.
            </p>

            {/* Existing custom lenses */}
            {customFields.length > 0 && (
              <div className="space-y-3 mb-3">
                {customFields.map((field, idx) => {
                  const isEditing = editingCustomIdx === idx;
                  if (isEditing) {
                    return (
                      <div key={field.id} className="p-3 border-2 border-primary/30 rounded-lg space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            maxLength={100}
                            placeholder="Lens label"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            maxLength={500}
                            placeholder="Prompt instruction for this lens"
                            rows={2}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Weight</Label>
                          <Slider
                            min={0}
                            max={1}
                            step={0.1}
                            value={[editWeight]}
                            onValueChange={([val]) => setEditWeight(roundWeight(val))}
                            className="flex-1 max-w-48"
                          />
                          <span className="text-xs font-mono w-8">{editWeight.toFixed(1)}</span>
                        </div>
                        {editLabelError && (
                          <p className="text-xs text-destructive">{editLabelError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={saveEditCustom}>
                            <Check className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEditCustom}>
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  const lens = watchedCustomLenses[idx];
                  return (
                    <div key={field.id} className="flex items-center gap-4 p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {lens?.label}
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">custom</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{lens?.description}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Controller
                          control={control}
                          name={`custom_lenses.${idx}.weight`}
                          render={({ field: f }) => (
                            <div className="flex items-center gap-2 w-48">
                              <Slider
                                min={0}
                                max={1}
                                step={0.1}
                                value={[f.value]}
                                onValueChange={([val]) => f.onChange(roundWeight(val))}
                                className="flex-1"
                              />
                              <span className="text-xs font-mono w-8 text-right">{f.value.toFixed(1)}</span>
                            </div>
                          )}
                        />
                        <Controller
                          control={control}
                          name={`custom_lenses.${idx}.enabled`}
                          render={({ field: f }) => (
                            <Switch
                              checked={f.value}
                              onCheckedChange={f.onChange}
                              aria-label={`Enable ${lens?.label}`}
                            />
                          )}
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEditCustom(idx)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeCustom(idx)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add custom lens form */}
            {showAddCustom ? (
              <div className="p-3 border-2 border-dashed border-primary/30 rounded-lg space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Soil Health"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={newCustomDescription}
                    onChange={(e) => setNewCustomDescription(e.target.value)}
                    maxLength={500}
                    placeholder="Prompt instruction, e.g. How does this practice affect long-term soil health?"
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Weight</Label>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={[newCustomWeight]}
                    onValueChange={([val]) => setNewCustomWeight(roundWeight(val))}
                    className="flex-1 max-w-48"
                  />
                  <span className="text-xs font-mono w-8">{newCustomWeight.toFixed(1)}</span>
                </div>
                {customLabelError && (
                  <p className="text-xs text-destructive">{customLabelError}</p>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleAddCustomLens}>
                    <Plus className="w-3 h-3 mr-1" /> Add Lens
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddCustom(false); setCustomLabelError(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddCustom(true)}
                disabled={watchedCustomLenses.length >= MAX_CUSTOM_LENSES}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Custom Lens
              </Button>
            )}

            {errors.custom_lenses && typeof errors.custom_lenses === 'object' && 'message' in errors.custom_lenses && (
              <p className="text-xs text-destructive mt-1">{(errors.custom_lenses as any).message}</p>
            )}
          </div>


          {/* ============================================================= */}
          {/* GAP BOOST RULES SECTION                                       */}
          {/* ============================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold">Gap Boost Rules</h3>
              <span className="text-xs text-muted-foreground">{watchedRules.length}/{MAX_GAP_BOOST_RULES}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Boost specific lens weights when capability gaps exceed a threshold. The rule with the highest matching threshold is applied.
            </p>

            {/* Existing rules */}
            {ruleFields.length > 0 && (
              <div className="space-y-2 mb-3">
                {ruleFields.map((field, idx) => {
                  const rule = watchedRules[idx];
                  const selectedLabels = (rule?.lens_keys || []).map((k) => {
                    const found = allLensKeys.find((lk) => lk.key === k);
                    return found?.label || k;
                  });
                  return (
                    <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50/50 dark:bg-orange-950/20">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <span className="font-medium">Gap ≥ {rule?.threshold}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                          <span className="font-medium">×{rule?.multiplier}</span>
                          <span className="mx-2 text-muted-foreground">on</span>
                          <span className="text-xs">{selectedLabels.join(', ')}</span>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(idx)} className="text-destructive hover:text-destructive shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add rule form */}
            {showAddRule ? (
              <div className="p-3 border-2 border-dashed border-primary/30 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Threshold (≥ 0.5)</Label>
                    <Input
                      type="number"
                      min={0.5}
                      step={0.1}
                      value={newRuleThreshold}
                      onChange={(e) => setNewRuleThreshold(parseFloat(e.target.value) || 0.5)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Multiplier (1.1–3.0)</Label>
                    <Input
                      type="number"
                      min={1.1}
                      max={3.0}
                      step={0.1}
                      value={newRuleMultiplier}
                      onChange={(e) => setNewRuleMultiplier(parseFloat(e.target.value) || 1.5)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target Lenses</Label>
                  <MultiSelect>
                    <MultiSelectTrigger
                      placeholder="Select lenses to boost..."
                      selectedItems={newRuleLensKeys.map((k) => ({
                        id: k,
                        label: allLensKeys.find((lk) => lk.key === k)?.label || k,
                      }))}
                      onRemoveItem={(id) => setNewRuleLensKeys((prev) => prev.filter((k) => k !== id))}
                    />
                    <MultiSelectContent searchable searchPlaceholder="Search lenses...">
                      {allLensKeys.map((lk) => (
                        <MultiSelectItem
                          key={lk.key}
                          checked={newRuleLensKeys.includes(lk.key)}
                          onSelect={() => {
                            setNewRuleLensKeys((prev) =>
                              prev.includes(lk.key)
                                ? prev.filter((k) => k !== lk.key)
                                : [...prev, lk.key]
                            );
                          }}
                        >
                          {lk.label}
                        </MultiSelectItem>
                      ))}
                    </MultiSelectContent>
                  </MultiSelect>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleAddRule} disabled={newRuleLensKeys.length === 0}>
                    <Plus className="w-3 h-3 mr-1" /> Add Rule
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowAddRule(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddRule(true)}
                disabled={watchedRules.length >= MAX_GAP_BOOST_RULES}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Gap Boost Rule
              </Button>
            )}
          </div>

          {/* ============================================================= */}
          {/* SAVE BUTTON                                                   */}
          {/* ============================================================= */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Lens Configuration'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
