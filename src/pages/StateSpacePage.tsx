import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Library, Trash2, Play, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  validateStateSpaceJson,
  type NonlinearModel,
} from '@/lib/stateSpaceSchema';
import {
  runSimulation,
  runGoldenPathSimulation,
  normalizeTrajectory,
  type SimulationResult,
  type SimulationError,
  type GoldenPathResult,
  type InterventionLogEntry,
} from '@/lib/simulationEngine';
import { extractControlRuleVariables, extractThresholds, extractDependencies } from '@/lib/controlRuleChartUtils';
import { compile as mathjsCompile, type EvalFunction } from 'mathjs';
import { SPCChart } from '@/components/SPCChart';
import type { SPCChartProps, SPCPhaseBand, SPCPhaseIndicatorBand, SPCRuleViolation } from '@/components/SPCChart';
import {
  useStateSpaceModelsByEntity,
  useCreateStateSpaceModel,
  useCreateModelAssociation,
  useDeleteModelAssociation,
  useDeleteStateSpaceModel,
} from '@/hooks/useStateSpaceModels';
import { useToast } from '@/hooks/use-toast';
import { StateSpaceModelLibrary } from '@/components/StateSpaceModelLibrary';
import type { StateSpaceModelRecord } from '@/lib/stateSpaceApi';

const STATE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#65a30d', '#c026d3', '#ea580c',
  '#4f46e5', '#059669',
];

const PHASE_BAND_COLORS = [
  '#3b82f620', // light blue
  '#22c55e20', // light green
  '#f9731620', // light orange
  '#a855f720', // light purple
  '#06b6d420', // light cyan
  '#f43f5e20', // light rose
];

interface PhaseTransition {
  timeDays: number;
  fromPhase: string;
  toPhase: string;
}

interface PhaseBand {
  startDays: number;
  endDays: number;
  phaseName: string;
  colorIndex: number;
}

interface InterventionMarker {
  timeDays: number;
  label: string;
  stateKey: string;
  delta: number;
}

function computePhaseTransitions(gpResult: GoldenPathResult): PhaseTransition[] {
  const transitions: PhaseTransition[] = [];
  const { phaseHistory, timePoints } = gpResult;
  for (let i = 1; i < phaseHistory.length; i++) {
    if (phaseHistory[i] !== phaseHistory[i - 1]) {
      transitions.push({
        timeDays: timePoints[i],
        fromPhase: phaseHistory[i - 1],
        toPhase: phaseHistory[i],
      });
    }
  }
  return transitions;
}

function computePhaseBands(gpResult: GoldenPathResult): PhaseBand[] {
  const bands: PhaseBand[] = [];
  const { phaseHistory, timePoints } = gpResult;
  if (phaseHistory.length === 0) return bands;

  const phaseNameToIndex = new Map<string, number>();
  let nextIndex = 0;

  let bandStart = 0;
  let currentPhase = phaseHistory[0];

  for (let i = 1; i < phaseHistory.length; i++) {
    if (phaseHistory[i] !== currentPhase) {
      if (!phaseNameToIndex.has(currentPhase)) {
        phaseNameToIndex.set(currentPhase, nextIndex++);
      }
      bands.push({
        startDays: timePoints[bandStart],
        endDays: timePoints[i],
        phaseName: currentPhase,
        colorIndex: phaseNameToIndex.get(currentPhase)!,
      });
      bandStart = i;
      currentPhase = phaseHistory[i];
    }
  }
  // Final band
  if (!phaseNameToIndex.has(currentPhase)) {
    phaseNameToIndex.set(currentPhase, nextIndex++);
  }
  bands.push({
    startDays: timePoints[bandStart],
    endDays: timePoints[timePoints.length - 1],
    phaseName: currentPhase,
    colorIndex: phaseNameToIndex.get(currentPhase)!,
  });

  return bands;
}

function computeInterventionMarkers(gpResult: GoldenPathResult): InterventionMarker[] {
  return gpResult.interventionLog.map((entry) => ({
    timeDays: entry.timeHours / 24,
    label: entry.label,
    stateKey: entry.stateKey,
    delta: entry.delta,
  }));
}

// Custom tooltip for golden path mode — shows phase, actuator states, and intervention info
function GoldenPathTooltip({
  active,
  payload,
  label,
  gpResult,
  model,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  gpResult: GoldenPathResult;
  model: NonlinearModel;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;

  const timeDays = Number(label);
  const { phaseHistory, timePoints, actuatorTraces, interventionLog } = gpResult;

  // Find the closest time index
  let closestIdx = 0;
  let minDist = Math.abs(timePoints[0] - timeDays);
  for (let i = 1; i < timePoints.length; i++) {
    const dist = Math.abs(timePoints[i] - timeDays);
    if (dist < minDist) {
      minDist = dist;
      closestIdx = i;
    }
  }

  const activePhase = phaseHistory[closestIdx] ?? '';
  const actuatorKeys = Object.keys(actuatorTraces);

  // Find interventions near this time point (within ±0.5 day)
  const nearbyInterventions = interventionLog.filter(
    (entry) => Math.abs(entry.timeHours / 24 - timeDays) < 0.5
  );

  // Find which rule triggered each actuator (look at control_policy phases)
  const currentPhaseObj = model.control_policy?.phases.find((p) => p.name === activePhase);

  return (
    <div className="bg-background border rounded-md shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold mb-1">Day {timeDays.toFixed(2)}</p>
      <p className="text-muted-foreground mb-2">
        Phase: <span className="font-medium text-foreground">{activePhase}</span>
      </p>

      {/* State values */}
      <div className="space-y-0.5 mb-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex justify-between gap-3">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-mono">{entry.value != null ? entry.value.toFixed(4) : ''}</span>
          </div>
        ))}
      </div>

      {/* Actuator states */}
      {actuatorKeys.length > 0 && (
        <div className="border-t pt-1 mt-1">
          <p className="text-muted-foreground text-xs mb-0.5">Actuators:</p>
          {actuatorKeys.map((key) => {
            const val = actuatorTraces[key][closestIdx] ?? 0;
            // Find triggering rule
            const triggeringRule = currentPhaseObj?.rules.find((r) => r.actuator === key);
            return (
              <div key={key} className="flex justify-between gap-2 text-xs">
                <span className="font-mono">{key}: {val === 1 ? 'ON' : 'OFF'}</span>
                {val === 1 && triggeringRule && (
                  <span className="text-muted-foreground truncate" title={triggeringRule.condition}>
                    ({triggeringRule.condition})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nearby interventions */}
      {nearbyInterventions.length > 0 && (
        <div className="border-t pt-1 mt-1">
          <p className="text-muted-foreground text-xs mb-0.5">Interventions:</p>
          {nearbyInterventions.map((iv, i) => (
            <div key={i} className="text-xs">
              <span className="font-medium">{iv.label}</span>
              <span className="text-muted-foreground ml-1">
                ({iv.stateKey} {iv.delta >= 0 ? '+' : ''}{iv.delta})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PageMode = 'empty' | 'display';

export default function StateSpacePage() {
  const { actionId, entityType: routeEntityType, entityId: routeEntityId } = useParams<{ actionId?: string; entityType?: string; entityId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Support both legacy /actions/:actionId/state-space and generic /combined-assets/:entityType/:entityId/state-space
  const entityType = routeEntityType || 'action';
  const entityId = routeEntityId || actionId || '';

  // Fetch associated model from backend
  const { data: entityData, isLoading: isLoadingModel } = useStateSpaceModelsByEntity(entityType, entityId);
  const existingRecord = entityData?.data?.[0] ?? null;

  // Derive model from backend data
  const [localModel, setLocalModel] = useState<NonlinearModel | null>(null);
  const [existingModelId, setExistingModelId] = useState<string | null>(null);
  const [existingAssociationId, setExistingAssociationId] = useState<string | null>(null);

  // Sync backend data into local state when it arrives
  useEffect(() => {
    if (existingRecord) {
      const def = existingRecord.model_definition;
      // Guard against old linear-format models missing nonlinear fields
      if (def && def.state_definitions && def.state_update_equations && def.simulation_config) {
        setLocalModel(def);
        setMode('display');
      } else {
        // Old format model — stay in empty mode with an error
        setErrors([
          'This action has a model saved in the old linear format which is no longer supported. Please paste a new nonlinear model or delete the existing one.',
        ]);
        setMode('empty');
      }
      setExistingModelId(existingRecord.id);
      setExistingAssociationId((existingRecord as any).association_id ?? null);
    }
  }, [existingRecord]);

  const model = localModel;

  const [pasteInput, setPasteInput] = useState('');
  const [mode, setMode] = useState<PageMode>('empty');
  const [errors, setErrors] = useState<string[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Simulation state
  const [initialConditions, setInitialConditions] = useState<Record<string, number>>({});
  const [actuatorValues, setActuatorValues] = useState<Record<string, number>>({});
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simError, setSimError] = useState<SimulationError | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [normalized, setNormalized] = useState(false);

  // Golden path state
  const [goldenPathMode, setGoldenPathMode] = useState(false);
  const [gpResult, setGpResult] = useState<GoldenPathResult | null>(null);

  // Initialize slider values when model changes
  useEffect(() => {
    if (model) {
      const ic: Record<string, number> = {};
      for (const [key, def] of Object.entries(model.state_definitions ?? {})) {
        ic[key] = def.default_value;
      }
      setInitialConditions(ic);

      const av: Record<string, number> = {};
      for (const key of Object.keys(model.input_vectors?.u_actuators ?? {})) {
        av[key] = 0;
      }
      setActuatorValues(av);

      // Reset simulation state on model change
      setSimResult(null);
      setSimError(null);
      setHiddenSeries(new Set());
      setNormalized(false);
      setGoldenPathMode(false);
      setGpResult(null);
    }
  }, [model]);

  const handleRunSimulation = useCallback(() => {
    if (!model) return;
    setSimError(null);
    const outcome = runSimulation(model, initialConditions, actuatorValues);
    if (outcome.success) {
      setSimResult(outcome.result);
    } else {
      setSimResult(null);
      setSimError(outcome.error);
    }
  }, [model, initialConditions, actuatorValues]);

  const handleRunGoldenPath = useCallback(() => {
    if (!model) return;
    setSimError(null);
    setGoldenPathMode(true);

    // If model has control_spec but no control_policy, inject a minimal pass-through policy
    let simModel = model;
    if (!model.control_policy && model.control_spec) {
      simModel = {
        ...model,
        control_policy: {
          initial_phase: "default",
          phases: [{
            name: "default",
            entry_condition: "1",
            rules: [],
            exit_threshold: null,
          }],
        },
      };
    }

    const outcome = runGoldenPathSimulation(simModel, initialConditions);
    if (outcome.success) {
      setGpResult(outcome.result);
    } else {
      setGpResult(null);
      setSimError(outcome.error);
    }
  }, [model, initialConditions]);

  const handleToggleGoldenPathOff = useCallback(() => {
    setGoldenPathMode(false);
    setGpResult(null);
  }, []);

  // Compute slider range for a state variable (±5x default or at least ±1)
  const getStateRange = (defaultVal: number): [number, number] => {
    const absVal = Math.abs(defaultVal);
    if (absVal === 0) return [-1, 1];
    return [0, absVal * 5];
  };

  // Transform SimulationResult to Recharts data format
  const activeResult = goldenPathMode && gpResult ? gpResult : simResult;
  const chartData = activeResult
    ? (() => {
        const source = normalized ? normalizeTrajectory(activeResult) : activeResult;
        const stateKeys = Object.keys(source.stateHistory);
        return source.timePoints.map((t, i) => ({
          time: t,
          ...Object.fromEntries(stateKeys.map((k) => [k, source.stateHistory[k][i]])),
        }));
      })()
    : [];

  const handleLegendClick = (dataKey: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  // Compute chart annotations for golden path mode
  const phaseTransitions = goldenPathMode && gpResult ? computePhaseTransitions(gpResult) : [];
  const phaseBands = goldenPathMode && gpResult ? computePhaseBands(gpResult) : [];
  const interventionMarkers =
    goldenPathMode && gpResult && model?.interventions
      ? computeInterventionMarkers(gpResult)
      : [];

  // Compute SPC chart data for each controlled variable
  const spcChartDataList = useMemo<SPCChartProps[]>(() => {
    if (!gpResult || !model) return [];

    // --- New control_spec path ---
    if (model.control_spec) {
      const charts: SPCChartProps[] = [];
      const spec = model.control_spec;

      // Compute phase indicator bands from phase_indicators
      let phaseIndicatorBands: SPCPhaseIndicatorBand[] | undefined;
      if (model.phase_indicators) {
        const compiledIndicators: { name: string; expr: EvalFunction }[] = [];
        for (const [name, exprStr] of Object.entries(model.phase_indicators)) {
          try {
            compiledIndicators.push({ name, expr: mathjsCompile(exprStr) as unknown as EvalFunction });
          } catch { /* skip invalid expressions */ }
        }

        if (compiledIndicators.length > 0) {
          const bands: SPCPhaseIndicatorBand[] = [];
          let currentPhase: string | null = null;
          let bandStart = 0;

          for (let i = 0; i < gpResult.timePoints.length; i++) {
            const scope: Record<string, number> = {};
            for (const [k, vals] of Object.entries(gpResult.stateHistory)) {
              scope[k] = vals[i];
            }

            let activePhase: string | null = null;
            for (const { name, expr } of compiledIndicators) {
              try {
                const val = expr.evaluate(scope);
                if (val && val !== 0) { activePhase = name; break; }
              } catch { /* skip */ }
            }

            if (activePhase !== currentPhase) {
              if (currentPhase !== null) {
                bands.push({ startTime: bandStart, endTime: gpResult.timePoints[i], label: currentPhase });
              }
              currentPhase = activePhase;
              bandStart = gpResult.timePoints[i];
            }
          }
          if (currentPhase !== null) {
            bands.push({ startTime: bandStart, endTime: gpResult.timePoints[gpResult.timePoints.length - 1], label: currentPhase });
          }
          phaseIndicatorBands = bands;
        }
      }

      for (const [elementKey, element] of Object.entries(spec.control_elements)) {
        // Extract the state variable key from the element key (e.g., "temperature_x1" -> "x1")
        const varKey = elementKey.split('_').pop() ?? elementKey;
        if (!gpResult.stateHistory[varKey]) continue;

        const stateDef = model.state_definitions[varKey];
        if (!stateDef) continue;

        // Compute rule violation zones
        let ruleViolations: SPCRuleViolation[] | undefined;
        if (element.rules.length > 0) {
          const violations: SPCRuleViolation[] = [];
          const compiledRules: { expr: EvalFunction; intent: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; note?: string }[] = [];
          for (const rule of element.rules) {
            try {
              compiledRules.push({ expr: mathjsCompile(rule.condition) as unknown as EvalFunction, intent: rule.intent, severity: rule.severity, note: rule.note });
            } catch { /* skip */ }
          }

          for (const cr of compiledRules) {
            let inViolation = false;
            let violationStart = 0;
            for (let i = 0; i < gpResult.timePoints.length; i++) {
              const scope: Record<string, number> = {};
              for (const [k, vals] of Object.entries(gpResult.stateHistory)) {
                scope[k] = vals[i];
              }
              let triggered = false;
              try {
                const val = cr.expr.evaluate(scope);
                triggered = val && val !== 0;
              } catch { /* skip */ }

              if (triggered && !inViolation) {
                inViolation = true;
                violationStart = gpResult.timePoints[i];
              } else if (!triggered && inViolation) {
                inViolation = false;
                violations.push({ startTime: violationStart, endTime: gpResult.timePoints[i], intent: cr.intent, severity: cr.severity, note: cr.note });
              }
            }
            if (inViolation) {
              violations.push({ startTime: violationStart, endTime: gpResult.timePoints[gpResult.timePoints.length - 1], intent: cr.intent, severity: cr.severity, note: cr.note });
            }
          }
          if (violations.length > 0) ruleViolations = violations;
        }

        // Compute dynamic target values if target_function is defined
        let targetValues: number[] | undefined;
        if (element.target_function) {
          try {
            const targetExpr = mathjsCompile(element.target_function);
            targetValues = gpResult.timePoints.map((_, i) => {
              const scope: Record<string, number> = {};
              for (const [k, vals] of Object.entries(gpResult.stateHistory)) {
                scope[k] = vals[i];
              }
              try { return targetExpr.evaluate(scope) as number; } catch { return 0; }
            });
          } catch { /* skip */ }
        }

        // Build dependencies for IVs
        const deps = extractDependencies(model, varKey);
        const independentVariables = deps
          .map((dep) => {
            const values = dep.isActuator ? gpResult.actuatorTraces[dep.key] : gpResult.stateHistory[dep.key];
            if (!values) return null;
            const depDef = model.state_definitions[dep.key];
            const ivLabel = depDef ? `${dep.key} (${depDef.name})` : dep.key;
            return { key: dep.key, label: ivLabel, values };
          })
          .filter((iv): iv is NonNullable<typeof iv> => iv !== null);

        charts.push({
          label: stateDef.name,
          unit: stateDef.unit,
          timePoints: gpResult.timePoints,
          values: gpResult.stateHistory[varKey],
          target: element.target,
          targetValues,
          specLimits: element.spec_limits,
          phaseIndicatorBands,
          ruleViolations,
          independentVariables: independentVariables.length > 0 ? independentVariables : undefined,
        });
      }

      return charts;
    }

    // --- Legacy control_policy path ---
    if (!model.control_policy) return [];

    const controlledKeys = extractControlRuleVariables(model.control_policy, model.state_definitions);
    if (controlledKeys.size === 0) return [];

    const bands = computePhaseBands(gpResult);
    const spcPhaseBands: SPCPhaseBand[] = bands.map((b) => ({
      startTime: b.startDays,
      endTime: b.endDays,
      label: b.phaseName,
      colorIndex: b.colorIndex,
    }));

    const charts: SPCChartProps[] = [];

    for (const key of controlledKeys) {
      if (!gpResult.stateHistory[key]) continue;

      const stateDef = model.state_definitions[key];
      const thresholds = extractThresholds(model.control_policy, key);
      const deps = extractDependencies(model, key);

      const independentVariables = deps
        .map((dep) => {
          let values: number[] | undefined;
          let depLabel: string;

          if (dep.isActuator) {
            values = gpResult.actuatorTraces[dep.key];
            depLabel = dep.key;
          } else {
            values = gpResult.stateHistory[dep.key];
            const depDef = model.state_definitions[dep.key];
            depLabel = depDef ? `${dep.key} (${depDef.name})` : dep.key;
          }

          if (!values) return null;
          return { key: dep.key, label: depLabel, values };
        })
        .filter((iv): iv is NonNullable<typeof iv> => iv !== null);

      charts.push({
        label: stateDef.name,
        unit: stateDef.unit,
        timePoints: gpResult.timePoints,
        values: gpResult.stateHistory[key],
        thresholds: thresholds.map((t) => ({
          value: t.value,
          label: t.label,
        })),
        phaseBands: spcPhaseBands,
        independentVariables: independentVariables.length > 0 ? independentVariables : undefined,
      });
    }

    return charts;
  }, [gpResult, model]);

  // Mutations
  const createModel = useCreateStateSpaceModel();
  const createAssociation = useCreateModelAssociation();
  const deleteAssociation = useDeleteModelAssociation();
  const deleteModel = useDeleteStateSpaceModel();

  const isSaving = createModel.isPending || createAssociation.isPending || deleteAssociation.isPending;
  const isDeleting = deleteModel.isPending;

  const handleSave = async (modelToSave: NonlinearModel) => {
    if (!entityId) return;

    try {
      // Remove existing association if switching models
      if (existingModelId && existingAssociationId) {
        await deleteAssociation.mutateAsync({
          modelId: existingModelId,
          associationId: existingAssociationId,
          entityType,
          entityId,
        });
      }

      // Create new model and associate with entity
      const result = await createModel.mutateAsync({
        model_definition: modelToSave,
      });
      const newModelId = result.data.id;

      await createAssociation.mutateAsync({
        modelId: newModelId,
        entityType,
        entityId,
      });

      setExistingModelId(newModelId);
      setExistingAssociationId(null); // will be refreshed on next query
      setLocalModel(modelToSave);
      setErrors([]);
      setMode('display');
      toast({
        title: 'Model saved',
        description: `${modelToSave.model_metadata.name} saved successfully.`,
      });
    } catch (err: any) {
      const message = err?.message || 'An unexpected error occurred. Please contact your developer.';
      toast({
        title: 'Save failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!existingModelId) return;

    try {
      await deleteModel.mutateAsync(existingModelId);
      setLocalModel(null);
      setExistingModelId(null);
      setMode('empty');
      setPasteInput('');
      toast({
        title: 'Model deleted',
        description: 'Model has been removed.',
      });
    } catch (err: any) {
      // If server says not found, the model is already gone — clean up local state
      const is404 = err?.message?.includes('not found') || err?.status === 404;
      if (is404) {
        setLocalModel(null);
        setExistingModelId(null);
        setMode('empty');
        setPasteInput('');
        toast({
          title: 'Model deleted',
          description: 'Model was already removed from the server.',
        });
        return;
      }
      const message = err?.message || 'An unexpected error occurred. Please contact your developer.';
      toast({
        title: 'Delete failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const exampleModel = JSON.stringify({
    model_metadata: {
      name: "sapi-an-1ton-siege",
      version: "3.0.0",
      author: "CWF Digital Twin Team",
      description: "Nonlinear state-space model for Sapi-an 1-ton drum composting biological siege"
    },
    model_description_prompt: "This model simulates a 1-ton drum composting process at the Sapi-an facility. It tracks temperature, mesophilic and thermophilic microbial populations, sugar and lignin substrate consumption, nitrogen, moisture, oxygen, bio-availability, inert mass, drum capacity, and material volume over a 14-day composting cycle. The model captures nonlinear microbial growth kinetics with Gaussian temperature-dependent growth rates, Monod-type nutrient limitation, and lignin softening transitions. Operator inputs are fan duty cycle (aeration) and drum motor rotation.",
    constants: {
      h_m: { value: 4800, name: "Mesophilic Heat Generation", unit: "J/kg" },
      h_t: { value: 7800, name: "Thermophilic Heat Generation", unit: "J/kg" },
      C_th: { value: 3.8, name: "Thermal Capacity", unit: "kJ/(kg·°C)" },
      k_loss_ambient: { value: 0.08, name: "Ambient Heat Loss Coefficient", unit: "1/hr" },
      k_latent: { value: 0.5, name: "Latent Heat Loss (Evaporation) Coefficient", unit: "1/hr" },
      mu_max_m: { value: 0.22, name: "Max Mesophilic Growth Rate", unit: "1/hr" },
      mu_max_t: { value: 0.35, name: "Max Thermophilic Growth Rate", unit: "1/hr" },
      K_o: { value: 0.1, name: "Oxygen Half-Saturation", unit: "kg" },
      K_s: { value: 8.0, name: "Sugar Half-Saturation", unit: "kg" },
      K_n: { value: 1.0, name: "Nitrogen Half-Saturation", unit: "kg" },
      k_soft: { value: 0.5, name: "Lignin Softening Rate", unit: "1/°C" },
      Y_s: { value: 0.4, name: "Sugar Yield Coefficient", unit: "kg/kg" },
      Y_l: { value: 0.3, name: "Lignin Yield Coefficient", unit: "kg/kg" },
      k_evap: { value: 0.03, name: "Moisture Evaporation Coefficient", unit: "kg/(hr·°C)" },
      k_settle: { value: 0.015, name: "Volume Settling Coefficient", unit: "m³/hr" },
      t_amb: { value: 30.0, name: "Ambient Temperature", unit: "°C" },
      k_diff: { value: 0.5, name: "Oxygen Diffusion Rate", unit: "kg/(hr)" },
      q_resp: { value: 0.02, name: "Microbial Respiration Rate", unit: "kg_O2/(kg_bio·hr)" },
      k_abr: { value: 0.005, name: "Abrasion Rate", unit: "1/hr" },
      k_bio_consume: { value: 0.01, name: "Bioavailability Consumption Rate", unit: "1/(kg_bio·hr)" },
      k_vol_loss: { value: 0.003, name: "Volume Loss from Decomposition", unit: "m³/(kg·hr)" },
      Y_n: { value: 0.1, name: "Nitrogen Yield Coefficient", unit: "kg_N/kg_bio" },
      x10: { value: 100.0, name: "Inert Mass (fixed)", unit: "kg" },
      x11: { value: 1.8, name: "Drum Capacity (fixed)", unit: "m³" }
    },
    state_definitions: {
      x1: { id: "t_k", name: "Max Temperature", unit: "°C", default_value: 30.0 },
      x2: { id: "m_meso", name: "Mesophilic Population", unit: "kg", default_value: 0.8 },
      x3: { id: "m_thermo", name: "Thermophilic Population", unit: "kg", default_value: 0.005 },
      x4: { id: "s_k", name: "Sugar Mass", unit: "kg", default_value: 160.0 },
      x5: { id: "l_k", name: "Lignin Mass", unit: "kg", default_value: 350.0 },
      x6: { id: "n_k", name: "Nitrogen Mass", unit: "kg", default_value: 18.0 },
      x7: { id: "w_k", name: "Water Mass", unit: "kg", default_value: 500.0 },
      x8: { id: "o_mass", name: "Oxygen Mass", unit: "kg", default_value: 2.0 },
      x9: { id: "alpha_k", name: "Bio-Availability", unit: "ratio", default_value: 0.1 },
      x12: { id: "v_k", name: "Material Volume", unit: "m³", default_value: 1.5 }
    },
    input_vectors: {
      u_actuators: {
        u_fan: "Fan duty cycle [0,1]",
        u_motor: "Drum motor rotation toggle [0,1]"
      },
      v_shocks: {
        delta_x: "AI-inferred correction vector from user observations"
      }
    },
    non_linear_transitions: {
      total_mass_M: "x2 + x3 + x4 + x5 + x6 + x7 + x10",
      rho_bulk: "total_mass_M / x12",
      phi_lim: "(x8 / (K_o + x8)) * (x4 / (K_s + x4)) * (x6 / (K_n + x6))",
      psi_soft: "1 / (1 + exp(-k_soft * (x1 - 55)))",
      mu_m: "mu_max_m * exp(-(x1 - 35)^2 / (2 * 64))",
      mu_t: "mu_max_t * exp(-(x1 - 60)^2 / (2 * 100))",
      dm: "0.02 + max(0, 0.25 * (x1 - 44))",
      death_rate_t: "0.02 + max(0, 0.4 * (x1 - 75))",
      afp: "(x11 - x12) / x11"
    },
    state_update_equations: {
      x1_next: "max(x1 + dt * ((h_m * mu_m * x2 + h_t * mu_t * x3) / (C_th * rho_bulk) - k_loss_ambient * (1 + 5 * u_motor + 15 * u_fan) * (x1 - t_amb) - k_latent * u_fan * (x1 - t_amb) * (x7 / x12)), t_amb)",
      x2_next: "max(x2 + dt * (mu_m * phi_lim * x2 - dm * x2), 0.0001)",
      x3_next: "max(x3 + dt * (mu_t * phi_lim * x3 - death_rate_t * x3), 0.005)",
      x4_next: "max(x4 - dt * ((1 / Y_s) * mu_m * phi_lim * x2), 0)",
      x5_next: "max(x5 - dt * ((1 / Y_l) * mu_t * phi_lim * x3 * x9 * psi_soft), 0)",
      x6_next: "max(x6 - dt * (Y_n * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0)",
      x7_next: "max(x7 - dt * (k_evap * u_fan * (x1 - t_amb)), 0.1)",
      x8_next: "max(x8 + dt * (k_diff * u_fan * afp - q_resp * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0)",
      x9_next: "min(max(x9 + dt * (k_abr * u_motor * psi_soft - k_bio_consume * mu_t * phi_lim * x3 * psi_soft), 0), 1.0)",
      x12_next: "max(x12 - dt * (k_settle * u_motor * psi_soft + k_vol_loss * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0.1)"
    },
    simulation_config: {
      dt: 0.05,
      total_days: 14
    },
    control_policy: {
      initial_phase: "phase_a_mesophilic_ignition",
      phases: [
        {
          name: "phase_a_mesophilic_ignition",
          entry_condition: "x1 < 55",
          rules: [
            { condition: "x1 > 68", actuator: "u_motor", value: 1, duration_steps: 1 },
            { condition: "x1 >= 72", actuator: "u_fan", value: 1, duration_steps: 10 }
          ],
          exit_threshold: "x1 >= 55"
        },
        {
          name: "phase_b_thermophilic_handover",
          entry_condition: "x1 >= 55",
          rules: [
            { condition: "x1 > 68", actuator: "u_motor", value: 1, duration_steps: 1 },
            { condition: "x1 >= 72", actuator: "u_fan", value: 1, duration_steps: 10 }
          ],
          exit_threshold: "x1 >= 70"
        },
        {
          name: "phase_c_lignin_breach",
          entry_condition: "x1 >= 70",
          rules: [
            { condition: "x1 > 68", actuator: "u_motor", value: 1, duration_steps: 1 },
            { condition: "x1 >= 72", actuator: "u_fan", value: 1, duration_steps: 10 },
            { condition: "x7 / (x2 + x3 + x4 + x5 + x6 + x7 + x10) < 0.45", actuator: "u_motor", value: 1, duration_steps: 3 }
          ],
          exit_threshold: null
        }
      ]
    },
    control_spec: {
      drum_id: "Sapi-an_Universal_Siege",
      control_elements: {
        temperature_x1: {
          target: 65.0,
          spec_limits: { USL: 72.0, LSL: 55.0 },
          rules: [
            { condition: "x1 > 68", intent: "NORMALIZE_HEAT_DISTRIBUTION", severity: "MEDIUM", note: "Spin drum to redistribute hot spots and center the process." },
            { condition: "x1 >= 72", intent: "EMERGENCY_HEAT_REJECTION", severity: "HIGH", note: "Immediate spinning required to prevent microbial death." }
          ]
        },
        moisture_x7: {
          target: 0.55,
          spec_limits: { USL: 0.65, LSL: 0.45 },
          rules: [
            { condition: "x7 < 0.45", intent: "INCREASE_MOISTURE", severity: "MEDIUM", note: "Microbes need liquid film for nitrogen transport." },
            { condition: "x7 > 0.65", intent: "REDUCE_MOISTURE_AERATE", severity: "MEDIUM", note: "Prevent anaerobic stall and heat-sink effect." }
          ]
        },
        bioavailability_x9: {
          target_function: "0.01 * x1",
          rules: [
            { condition: "x9 < 0.01 * x1", intent: "MECHANICAL_MACERATION", severity: "LOW", note: "Shatter lignin to expose cellulose fuel." }
          ]
        }
      },
      reaction_mechanisms: {
        nitrogen_injection: {
          condition: "x1 < 55",
          intent: "ADD_GREEN_NITROGEN_FUEL",
          note: "Breach is open but fuel is spent. Add manure or fresh greens."
        }
      }
    },
    phase_indicators: {
      mesophilic_active: "x1 >= 25 and x1 < 45",
      thermophilic_active: "x1 >= 45 and x1 < 70",
      overheat: "x1 >= 70",
      curing: "x1 < 40"
    },
    interventions: [
      { time_hours: 48, state_key: "x4", delta: 20.0, label: "Day 2: Add 20kg greens (sugar substrate)" },
      { time_hours: 48, state_key: "x7", delta: 15.0, label: "Day 2: Add 15kg moisture with greens" }
    ]
  }, null, 2);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => {
          if (entityType === 'action') {
            navigate(`/actions/${entityId}`);
          } else {
            navigate(`/combined-assets?edit=${entityId}`);
          }
        }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">State Space Control</h1>
      </div>

      {errors.length > 0 && (
        <Card className="mb-6 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive text-lg">Validation Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-sm text-destructive">
                  {error}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isLoadingModel && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading model...</span>
          </CardContent>
        </Card>
      )}

      {!isLoadingModel && mode === 'empty' && (
        <Card>
          <CardHeader>
            <CardTitle>Load State Space Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="Paste your state-space model JSON here..."
              rows={15}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const result = validateStateSpaceJson(pasteInput);
                  if (result.success) {
                    setLocalModel(result.model);
                    setErrors([]);
                    setMode('display');
                  } else {
                    setErrors(result.errors);
                  }
                }}
              >
                Validate
              </Button>
              <Button variant="outline" onClick={() => setPasteInput(exampleModel)}>Show Example</Button>
              <Button variant="outline" onClick={() => setLibraryOpen(true)}>
                <Library className="h-4 w-4 mr-2" />
                Browse Library
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display mode rendering */}
      {mode === 'display' && model && (
        <div className="space-y-6">
          {/* Header buttons */}
          <div className="flex justify-end gap-2">
            {!existingModelId && (
              <Button
                onClick={() => model && handleSave(model)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setLibraryOpen(true)}>
              <Library className="h-4 w-4 mr-2" />
              Browse Library
            </Button>
            {existingModelId && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* 1. Model Metadata — always visible */}
          <Card>
            <CardHeader>
              <CardTitle>Model Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{model.model_metadata.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-medium">{model.model_metadata.version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Author</p>
                <p className="font-medium">{model.model_metadata.author}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{model.model_metadata.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Details — collapsed by default, sub-items open when expanded */}
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer select-none py-2">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                <span className="text-sm font-semibold text-muted-foreground">Model Details</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6">

          {/* 2. Model Description Prompt */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    Model Description Prompt
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md font-mono">
                    {model.model_description_prompt}
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 3. Constants */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    Constants
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(model.constants ?? {}).map(([key, c]) => (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-sm">{key}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{c.value}</TableCell>
                      <TableCell className="text-muted-foreground">{c.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 4. State Definitions */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    State Definitions
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Default Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(model.state_definitions ?? {}).map(([key, s]) => (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-sm">{key}</TableCell>
                      <TableCell className="font-mono text-sm">{s.id}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.unit}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{s.default_value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 5. Input Vectors */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    Input Vectors
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Actuators (u)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(model.input_vectors?.u_actuators ?? {}).map(([key, desc]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-sm">{key}</TableCell>
                        <TableCell>{desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Shocks (v)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(model.input_vectors?.v_shocks ?? {}).map(([key, desc]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-sm">{key}</TableCell>
                        <TableCell>{desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 6. Non-Linear Transitions */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    Non-Linear Transitions
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  {Object.entries(model.non_linear_transitions ?? {}).map(([key, expr]) => (
                    <div key={key} className="flex items-start gap-3">
                      <span className="font-mono text-sm font-medium min-w-[140px] pt-1">{key}</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded-md flex-1 break-all">{expr}</code>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 7. State Update Equations */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    State Update Equations
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2">
                  {Object.entries(model.state_update_equations ?? {}).map(([key, expr]) => (
                    <div key={key} className="flex items-start gap-3">
                      <span className="font-mono text-sm font-medium min-w-[140px] pt-1">{key}</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded-md flex-1 break-all">{expr}</code>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 8. Simulation Config */}
          <Collapsible defaultOpen>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none">
                  <CardTitle className="flex items-center justify-between">
                    Simulation Config
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Time Step (dt)</p>
                    <p className="font-medium font-mono">{model.simulation_config.dt} hours</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Duration</p>
                    <p className="font-medium font-mono">{model.simulation_config.total_days} days</p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-4">
            {(model.control_policy || model.control_spec) && !goldenPathMode && (
              <Button variant="secondary" onClick={handleRunGoldenPath}>
                <Play className="h-4 w-4 mr-2" />
                Run Golden Path
              </Button>
            )}
            {goldenPathMode && (
              <Button variant="outline" onClick={handleToggleGoldenPathOff}>
                Exit Golden Path
              </Button>
            )}
          </div>

          {/* Simulation Error */}
          {simError && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive text-lg">Simulation Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive">
                  Expression <code className="font-mono bg-muted px-1 rounded">{simError.expressionKey}</code>
                  {' '}failed at time step {simError.timeStep}: {simError.message}
                </p>
              </CardContent>
            </Card>
          )}

          {/* SPC Control Charts — one per controlled variable */}
          {spcChartDataList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Control Rule Charts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {spcChartDataList.map((chartProps) => (
                  <SPCChart key={chartProps.label} {...chartProps} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* 10. Recharts LineChart */}
          {activeResult && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  State Trajectories {goldenPathMode && '(Golden Path)'} {normalized && '(Normalized 0–100)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={450}>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      ticks={Array.from({ length: Math.ceil(activeResult?.timePoints[activeResult.timePoints.length - 1] ?? 14) + 1 }, (_, i) => i)}
                      tickFormatter={(v: number) => `${v}`}
                      label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis
                      scale={normalized ? 'auto' : 'log'}
                      domain={normalized ? [0, 100] : [0.01, 'auto']}
                      allowDataOverflow={!normalized}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    {/* Phase bands as background shading */}
                    {phaseBands.map((band, i) => (
                      <ReferenceArea
                        key={`phase-band-${i}`}
                        x1={band.startDays}
                        x2={band.endDays}
                        fill={PHASE_BAND_COLORS[band.colorIndex % PHASE_BAND_COLORS.length]}
                        fillOpacity={1}
                        label={
                          i === 0 || phaseBands[i - 1]?.phaseName !== band.phaseName
                            ? { value: band.phaseName, position: 'insideTopLeft', fontSize: 10, fill: '#6b7280' }
                            : undefined
                        }
                      />
                    ))}
                    {/* Phase transition markers — vertical dashed gray lines */}
                    {phaseTransitions.map((pt, i) => (
                      <ReferenceLine
                        key={`phase-transition-${i}`}
                        x={pt.timeDays}
                        stroke="#9ca3af"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                        label={{
                          value: `→ ${pt.toPhase}`,
                          position: 'insideTopRight',
                          fontSize: 9,
                          fill: '#6b7280',
                        }}
                      />
                    ))}
                    {/* Intervention markers — vertical solid orange lines */}
                    {interventionMarkers.map((iv, i) => (
                      <ReferenceLine
                        key={`intervention-${i}`}
                        x={iv.timeDays}
                        stroke="#ea580c"
                        strokeWidth={2}
                        label={{
                          value: iv.label.length > 30 ? iv.label.slice(0, 27) + '…' : iv.label,
                          position: 'insideBottomRight',
                          fontSize: 9,
                          fill: '#ea580c',
                        }}
                      />
                    ))}
                    {/* Tooltip: custom in golden path mode, default otherwise */}
                    {goldenPathMode && gpResult && model ? (
                      <Tooltip
                        content={
                          <GoldenPathTooltip gpResult={gpResult} model={model} />
                        }
                      />
                    ) : (
                      <Tooltip
                        labelFormatter={(v: number) => `Day ${Number(v).toFixed(2)}`}
                        formatter={(value: number | undefined) => value != null ? value.toFixed(4) : ''}
                      />
                    )}
                    <Legend
                      onClick={(e) => {
                        if (e && e.dataKey) handleLegendClick(e.dataKey as string);
                      }}
                      wrapperStyle={{ cursor: 'pointer' }}
                    />
                    {Object.keys(model.state_definitions ?? {}).map((key, idx) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={`${key} (${model.state_definitions[key].name})`}
                        stroke={STATE_COLORS[idx % STATE_COLORS.length]}
                        dot={false}
                        strokeWidth={1.5}
                        hide={hiddenSeries.has(key)}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Actuator Traces Chart — separate panel below main chart */}
          {goldenPathMode && gpResult && (() => {
            const actuatorKeys = Object.keys(gpResult.actuatorTraces);
            if (actuatorKeys.length === 0) return null;
            const actuatorChartData = gpResult.timePoints.map((t, i) => ({
              time: t,
              ...Object.fromEntries(actuatorKeys.map((k) => [k, gpResult.actuatorTraces[k][i]])),
            }));
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Actuator Traces</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={actuatorChartData}>
                      <XAxis
                        dataKey="time"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        ticks={Array.from({ length: Math.ceil(gpResult.timePoints[gpResult.timePoints.length - 1] ?? 14) + 1 }, (_, i) => i)}
                        tickFormatter={(v: number) => `${v}`}
                        label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }}
                      />
                      <YAxis domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v: number) => (v === 1 ? 'ON' : 'OFF')} />
                      <Tooltip
                        labelFormatter={(v: number) => `Day ${Number(v).toFixed(2)}`}
                        formatter={(value: number | undefined) => (value === 1 ? 'ON' : 'OFF')}
                      />
                      <Legend />
                      {actuatorKeys.map((key, idx) => (
                        <Line
                          key={key}
                          type="stepAfter"
                          dataKey={key}
                          name={key}
                          stroke={STATE_COLORS[idx % STATE_COLORS.length]}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}

      {entityId && (
        <StateSpaceModelLibrary
          entityId={entityId}
          entityType={entityType}
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onSelect={async (record: StateSpaceModelRecord) => {
            // Remove old association if switching models
            if (existingModelId && existingAssociationId) {
              try {
                await deleteAssociation.mutateAsync({
                  modelId: existingModelId,
                  associationId: existingAssociationId,
                  entityType,
                  entityId,
                });
              } catch {
                // Continue even if delete fails — the new association is more important
              }
            }
            setLocalModel(record.model_definition);
            setExistingModelId(record.id);
            setExistingAssociationId(null);
            setMode('display');
          }}
        />
      )}
    </div>
  );
}
