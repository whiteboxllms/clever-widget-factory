import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Library, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
} from 'recharts';
import {
  validateStateSpaceJson,
  type NonlinearModel,
} from '@/lib/stateSpaceSchema';
import {
  runSimulation,
  normalizeTrajectory,
  type SimulationResult,
  type SimulationError,
} from '@/lib/simulationEngine';
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

type PageMode = 'empty' | 'display';

export default function StateSpacePage() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch associated model from backend
  const { data: entityData, isLoading: isLoadingModel } = useStateSpaceModelsByEntity('action', actionId ?? '');
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

  // Initialize slider values when model changes
  useEffect(() => {
    if (model) {
      const ic: Record<string, number> = {};
      for (const [key, def] of Object.entries(model.state_definitions)) {
        ic[key] = def.default_value;
      }
      setInitialConditions(ic);

      const av: Record<string, number> = {};
      for (const key of Object.keys(model.input_vectors.u_actuators)) {
        av[key] = 0;
      }
      setActuatorValues(av);

      // Reset simulation state on model change
      setSimResult(null);
      setSimError(null);
      setHiddenSeries(new Set());
      setNormalized(false);
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

  // Compute slider range for a state variable (±5x default or at least ±1)
  const getStateRange = (defaultVal: number): [number, number] => {
    const absVal = Math.abs(defaultVal);
    if (absVal === 0) return [-1, 1];
    return [0, absVal * 5];
  };

  // Transform SimulationResult to Recharts data format
  const chartData = simResult
    ? (() => {
        const source = normalized ? normalizeTrajectory(simResult) : simResult;
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

  // Mutations
  const createModel = useCreateStateSpaceModel();
  const createAssociation = useCreateModelAssociation();
  const deleteAssociation = useDeleteModelAssociation();
  const deleteModel = useDeleteStateSpaceModel();

  const isSaving = createModel.isPending || createAssociation.isPending || deleteAssociation.isPending;
  const isDeleting = deleteModel.isPending;

  const handleSave = async (modelToSave: NonlinearModel) => {
    if (!actionId) return;

    try {
      // Remove existing association if switching models
      if (existingModelId && existingAssociationId) {
        await deleteAssociation.mutateAsync({
          modelId: existingModelId,
          associationId: existingAssociationId,
          entityType: 'action',
          entityId: actionId,
        });
      }

      // Create new model and associate with action
      const result = await createModel.mutateAsync({
        model_definition: modelToSave,
      });
      const newModelId = result.data.id;

      await createAssociation.mutateAsync({
        modelId: newModelId,
        entityType: 'action',
        entityId: actionId,
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
      k_loss_active: { value: 1.0, name: "Active Aeration Heat Loss Coefficient", unit: "1/hr" },
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
      Y_n: { value: 0.1, name: "Nitrogen Yield Coefficient", unit: "kg_N/kg_bio" },
      x10: { value: 100.0, name: "Inert Mass (fixed)", unit: "kg" },
      x11: { value: 1.8, name: "Drum Capacity (fixed)", unit: "m³" }
    },
    state_definitions: {
      x1: { id: "t_k", name: "Core Temperature", unit: "°C", default_value: 30.0 },
      x2: { id: "m_meso", name: "Mesophilic Mass", unit: "kg", default_value: 0.8 },
      x3: { id: "m_thermo", name: "Thermophilic Mass", unit: "kg", default_value: 0.005 },
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
      k_now: "k_loss_ambient + (k_loss_active - k_loss_ambient) * u_fan",
      afp: "(x11 - x12) / x11"
    },
    state_update_equations: {
      x1_next: "max(x1 + dt * ((h_m * x2 + h_t * x3) / (C_th * rho_bulk) - k_now * u_fan * (x1 - t_amb)), t_amb)",
      x2_next: "max(x2 + dt * (mu_m * phi_lim * x2 - dm * x2), 0.0001)",
      x3_next: "max(x3 + dt * (mu_t * phi_lim * x3 - death_rate_t * x3), 0.005)",
      x4_next: "max(x4 - dt * ((1 / Y_s) * mu_m * phi_lim * x2), 0)",
      x5_next: "max(x5 - dt * ((1 / Y_l) * mu_t * phi_lim * x3 * x9 * psi_soft), 0)",
      x6_next: "max(x6 - dt * (Y_n * (mu_m * phi_lim * x2 + mu_t * phi_lim * x3)), 0)",
      x7_next: "max(x7 - dt * (k_evap * u_fan * (x1 - t_amb)), 0.1)",
      x8_next: "max(x8 + dt * (k_diff * u_fan * afp - q_resp * (x2 + x3)), 0)",
      x9_next: "min(x9 + dt * (k_abr * u_motor * psi_soft), 1.0)",
      x12_next: "max(x12 - dt * (k_settle * u_motor + 0.002 * abs((1 / Y_s) * mu_m * phi_lim * x2 + (1 / Y_l) * mu_t * phi_lim * x3 * x9 * psi_soft)), 0.1)"
    },
    simulation_config: {
      dt: 0.05,
      total_days: 14
    }
  }, null, 2);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="outline" onClick={() => navigate(`/actions/${actionId}`)}>
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

          {/* 1. Model Metadata */}
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

          {/* 2. Model Description Prompt */}
          <Card>
            <CardHeader>
              <CardTitle>Model Description Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md font-mono">
                {model.model_description_prompt}
              </p>
            </CardContent>
          </Card>

          {/* 3. Constants */}
          <Card>
            <CardHeader>
              <CardTitle>Constants</CardTitle>
            </CardHeader>
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
                  {Object.entries(model.constants).map(([key, c]) => (
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
          </Card>

          {/* 4. State Definitions */}
          <Card>
            <CardHeader>
              <CardTitle>State Definitions</CardTitle>
            </CardHeader>
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
                  {Object.entries(model.state_definitions).map(([key, s]) => (
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
          </Card>

          {/* 5. Input Vectors */}
          <Card>
            <CardHeader>
              <CardTitle>Input Vectors</CardTitle>
            </CardHeader>
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
                    {Object.entries(model.input_vectors.u_actuators).map(([key, desc]) => (
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
                    {Object.entries(model.input_vectors.v_shocks).map(([key, desc]) => (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-sm">{key}</TableCell>
                        <TableCell>{desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 6. Non-Linear Transitions */}
          <Card>
            <CardHeader>
              <CardTitle>Non-Linear Transitions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(model.non_linear_transitions).map(([key, expr]) => (
                <div key={key} className="flex items-start gap-3">
                  <span className="font-mono text-sm font-medium min-w-[140px] pt-1">{key}</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded-md flex-1 break-all">{expr}</code>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 7. State Update Equations */}
          <Card>
            <CardHeader>
              <CardTitle>State Update Equations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(model.state_update_equations).map(([key, expr]) => (
                <div key={key} className="flex items-start gap-3">
                  <span className="font-mono text-sm font-medium min-w-[140px] pt-1">{key}</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded-md flex-1 break-all">{expr}</code>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 8. Simulation Config */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Config</CardTitle>
            </CardHeader>
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
          </Card>

          {/* 9. Simulation Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Initial Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(model.state_definitions).map(([key, def]) => {
                const [min, max] = getStateRange(def.default_value);
                const step = (max - min) / 200 || 0.01;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">
                        {key} — {def.name} ({def.unit})
                      </Label>
                      <span className="text-sm font-mono text-muted-foreground w-24 text-right">
                        {(initialConditions[key] ?? def.default_value).toFixed(3)}
                      </span>
                    </div>
                    <Slider
                      min={min}
                      max={max}
                      step={step}
                      value={[initialConditions[key] ?? def.default_value]}
                      onValueChange={([v]) =>
                        setInitialConditions((prev) => ({ ...prev, [key]: v }))
                      }
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {Object.keys(model.input_vectors.u_actuators).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Actuator Inputs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(model.input_vectors.u_actuators).map(([key, desc]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">
                        {key} — {desc}
                      </Label>
                      <span className="text-sm font-mono text-muted-foreground w-16 text-right">
                        {(actuatorValues[key] ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.01}
                      value={[actuatorValues[key] ?? 0]}
                      onValueChange={([v]) =>
                        setActuatorValues((prev) => ({ ...prev, [key]: v }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleRunSimulation}>
              <Play className="h-4 w-4 mr-2" />
              Run Simulation
            </Button>
            {simResult && (
              <div className="flex items-center gap-2">
                <Switch
                  id="normalize-toggle"
                  checked={normalized}
                  onCheckedChange={setNormalized}
                />
                <Label htmlFor="normalize-toggle" className="text-sm">
                  Normalized view (0–100)
                </Label>
              </div>
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

          {/* 10. Recharts LineChart */}
          {simResult && chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  State Trajectories {normalized && '(Normalized 0–100)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={450}>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="time"
                      label={{ value: 'Time (days)', position: 'insideBottom', offset: -5 }}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <YAxis
                      scale={normalized ? 'auto' : 'log'}
                      domain={normalized ? [0, 100] : [0.01, 'auto']}
                      allowDataOverflow={!normalized}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <Tooltip
                      labelFormatter={(v: number) => `Day ${Number(v).toFixed(2)}`}
                      formatter={(value: number | undefined) => value != null ? value.toFixed(4) : ''}
                    />
                    <Legend
                      onClick={(e) => {
                        if (e && e.dataKey) handleLegendClick(e.dataKey as string);
                      }}
                      wrapperStyle={{ cursor: 'pointer' }}
                    />
                    {Object.keys(model.state_definitions).map((key, idx) => (
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
        </div>
      )}

      {actionId && (
        <StateSpaceModelLibrary
          actionId={actionId}
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onSelect={async (record: StateSpaceModelRecord) => {
            // Remove old association if switching models
            if (existingModelId && existingAssociationId) {
              try {
                await deleteAssociation.mutateAsync({
                  modelId: existingModelId,
                  associationId: existingAssociationId,
                  entityType: 'action',
                  entityId: actionId!,
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
