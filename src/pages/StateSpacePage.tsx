import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  validateStateSpaceJson,
  type StateSpaceModel,
  type Matrix,
} from '@/lib/stateSpaceSchema';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/** Renders a LaTeX string into HTML using KaTeX */
function Latex({ math, display = false }: { math: string; display?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(math, ref.current, { displayMode: display, throwOnError: false });
    }
  }, [math, display]);
  return <span ref={ref} />;
}

type PageMode = 'empty' | 'display' | 'editing';

/** Matrix display config: name, matrix data, row labels, column labels */
function getMatrixConfigs(model: StateSpaceModel) {
  const { matrices, labels } = model.state_space;
  return [
    { name: 'A', subtitle: 'State Transition (states × states)', matrix: matrices.A, rowLabels: labels.states, colLabels: labels.states },
    { name: 'B', subtitle: 'Input (states × inputs)', matrix: matrices.B, rowLabels: labels.states, colLabels: labels.inputs },
    { name: 'C', subtitle: 'Output (outputs × states)', matrix: matrices.C, rowLabels: labels.outputs, colLabels: labels.states },
    { name: 'D', subtitle: 'Feedthrough (outputs × inputs)', matrix: matrices.D, rowLabels: labels.outputs, colLabels: labels.inputs },
  ] as const;
}

function MatrixTable({ name, subtitle, matrix, rowLabels, colLabels }: {
  name: string;
  subtitle: string;
  matrix: Matrix;
  rowLabels: string[];
  colLabels: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Matrix {name}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32" />
              {colLabels.map((label) => (
                <TableHead key={label} className="text-center font-mono text-xs">
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map((row, i) => (
              <TableRow key={rowLabels[i]}>
                <TableCell className="font-mono text-xs font-medium">{rowLabels[i]}</TableCell>
                {row.map((val, j) => (
                  <TableCell key={j} className="text-center font-mono text-sm">
                    {val}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function StateSpacePage() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();

  const [pasteInput, setPasteInput] = useState('');
  const [model, setModel] = useState<StateSpaceModel | null>(null);
  const [mode, setMode] = useState<PageMode>('empty');
  const [errors, setErrors] = useState<string[]>([]);
  const [editInput, setEditInput] = useState('');

  const handleValidateAndLoad = () => {
    const result = validateStateSpaceJson(pasteInput);
    if (result.success) {
      setModel(result.model);
      setErrors([]);
      setMode('display');
    } else {
      setErrors(result.errors);
    }
  };

  const exampleModel = JSON.stringify({
    model_metadata: {
      model_id: "sapi-an-drum-v2.1",
      version: "2.1.0",
      author: "CWF Digital Twin Team",
      description: "Discrete-time state-space model for Sapi-an drum composting process"
    },
    state_space: {
      dimensions: { states: 4, inputs: 2, outputs: 3 },
      labels: {
        states: ["temperature", "moisture", "oxygen", "decomposition"],
        inputs: ["turning_frequency", "water_addition"],
        outputs: ["temperature_reading", "moisture_reading", "maturity_index"]
      },
      matrices: {
        A: [[0.95,0.02,-0.01,0.03],[-0.01,0.90,0.01,0.02],[0.03,-0.02,0.85,-0.01],[0.01,0.01,0.02,0.98]],
        B: [[0.15,-0.05],[-0.02,0.20],[0.10,-0.01],[0.05,0.03]],
        C: [[1.0,0.0,0.0,0.0],[0.0,1.0,0.0,0.0],[0.0,0.0,0.0,1.0]],
        D: [[0.0,0.0],[0.0,0.0],[0.0,0.0]]
      }
    },
    model_description_prompt: "This model represents a drum composting process at the Sapi-an facility. States track internal pile conditions: temperature (°C at pile center), moisture (% volumetric), oxygen (% concentration in interstitial air), and decomposition (0-1 normalized maturity index). Inputs are operator-controlled: turning_frequency (turns per day, applied by rotating the drum) and water_addition (liters added per step). Outputs are measured: temperature_reading (thermocouple probe at drum center), moisture_reading (capacitance sensor at drum wall), and maturity_index (lab-tested C:N ratio mapped to 0-1). Key priorities: maintain temperature between 55-65°C for pathogen kill, keep moisture 40-60% for microbial activity, and ensure oxygen stays above 10% to prevent anaerobic conditions."
  }, null, 2);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-start gap-3 mb-6">
        <Button variant="outline" className="mt-1" onClick={() => navigate(`/actions/${actionId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Collapsible defaultOpen className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">State Space Control</h1>
            <CollapsibleTrigger className="text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg.closed]:hidden [&[data-state=closed]>svg.open]:hidden">
              <ChevronDown className="h-5 w-5 open" />
              <ChevronRight className="h-5 w-5 closed" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <Card className="bg-muted/50 mt-3">
              <CardContent className="pt-6 pb-6">
                <h2 className="text-lg font-semibold text-center mb-4">Discrete-Time State-Space Equations</h2>
                <div className="flex flex-col lg:flex-row lg:gap-8 gap-4">
                  <div className="space-y-4 lg:flex-1">
                    <Latex display math="x_{k+1} = Ax_{k} + Bu_{k}" />
                    <Latex display math="y_{k} = Cx_{k} + Du_{k}" />
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1 lg:flex-1 lg:border-l lg:pl-8 border-t lg:border-t-0 pt-4 lg:pt-0">
                    <p><Latex math="x_{k}" /> — current state &ensp; <Latex math="u_{k}" /> — input / control</p>
                    <p><Latex math="y_{k}" /> — output / measurement</p>
                    <p className="pt-1"><Latex math="A" /> — state transition (<Latex math={"n \\times n"} />)</p>
                    <p><Latex math="B" /> — input (<Latex math={"n \\times m"} />)</p>
                    <p><Latex math="C" /> — output (<Latex math={"p \\times n"} />)</p>
                    <p><Latex math="D" /> — feedthrough (<Latex math={"p \\times m"} />)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
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

      {mode === 'empty' && (
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
              <Button onClick={handleValidateAndLoad}>Validate &amp; Load</Button>
              <Button variant="outline" onClick={() => setPasteInput(exampleModel)}>Show Example</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display mode rendering */}
      {mode === 'display' && model && (
        <div className="space-y-6">
          {/* Header with Edit button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => {
              setEditInput(JSON.stringify(model, null, 2));
              setMode('editing');
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>

          {/* Model Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Model Metadata</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Model ID</p>
                <p className="font-medium">{model.model_metadata.model_id}</p>
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

          {/* Dimensions & Labels */}
          <Card>
            <CardHeader>
              <CardTitle>Dimensions & Labels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="secondary">States: {model.state_space.dimensions.states}</Badge>
                <Badge variant="secondary">Inputs: {model.state_space.dimensions.inputs}</Badge>
                <Badge variant="secondary">Outputs: {model.state_space.dimensions.outputs}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">State Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {model.state_space.labels.states.map((label) => (
                      <Badge key={label} variant="outline">{label}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Input Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {model.state_space.labels.inputs.map((label) => (
                      <Badge key={label} variant="outline">{label}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Output Labels</p>
                  <div className="flex flex-wrap gap-1">
                    {model.state_space.labels.outputs.map((label) => (
                      <Badge key={label} variant="outline">{label}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Matrices */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {getMatrixConfigs(model).map((cfg) => (
              <MatrixTable key={cfg.name} {...cfg} />
            ))}
          </div>

          {/* Model Description Prompt */}
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
        </div>
      )}

      {/* Editing mode rendering */}
      {mode === 'editing' && (
        <Card>
          <CardHeader>
            <CardTitle>Edit State Space Model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={() => {
                const result = validateStateSpaceJson(editInput);
                if (result.success) {
                  setModel(result.model);
                  setErrors([]);
                  setMode('display');
                } else {
                  setErrors(result.errors);
                }
              }}>
                Save
              </Button>
              <Button variant="outline" onClick={() => {
                setErrors([]);
                setMode('display');
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
