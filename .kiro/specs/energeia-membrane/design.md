# Design Document: Energeia Membrane

## Overview

The Energeia Membrane extends the existing Energeia Schema pipeline and visualization with four interconnected capabilities:

1. **Energy classification** — every action is classified as `growth`, `maintenance`, or `process_improvement` by Claude, within the same Bedrock invocation that already generates cluster titles.
2. **Boundary classification** — every cluster is classified as `internal` or `external` by the same Claude call.
3. **Spatial separation** — after PCA normalization, external clusters and their action points are pushed radially outward beyond a computed membrane boundary distance, so the 3D scene has a clear inside/outside topology.
4. **Visual rendering** — a metaball membrane surface encloses internal clusters, and an energy allocation bar above the canvas shows the distribution of organizational effort.

All changes are additive. The existing pipeline, cache schema, and TypeScript types are extended, not replaced. No new Lambda functions are introduced; the work happens inside the existing `cwf-energeia-lambda` (refresh handler + Bedrock client) and the existing React component tree.

### Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Claude invocation count | Single call per cluster (unchanged) | Requirement 8.2 explicitly forbids a separate invocation |
| Spatial separation timing | Post-PCA normalization, pre-cache write | Requirement 3.7/3.8 — PCA is untouched |
| Membrane implementation | `MarchingCubes` from `three/examples/jsm` | Guarantees single merged blob (Req 4.3); no custom implicit surface math needed |
| Energy bar scope | Full cache payload, ignores UI filters | Requirement 5.9 — bar reflects full org picture |
| Classification override | None | Requirement 8.1 — re-run Refresh to change |

---

## Architecture

### Pipeline Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  lambda/energeia/handlers/refresh.js                                │
│                                                                     │
│  1. Fetch embeddings + actions (unchanged)                          │
│  2. Fan-out action-person points (unchanged)                        │
│  3. Invoke ML Lambda — k-means + PCA (unchanged)                    │
│  4. Normalize coords to ±20 (unchanged)                             │
│  5. Label clusters via bedrockClient.labelClusters()  ◄── EXTENDED  │
│     └─ now returns: title, description, boundary_type,              │
│        action_energy_map { actionTitle → energy_type }              │
│  6. Compute center_of_mass from internal cluster centroids  ◄── NEW │
│  7. Compute membrane_boundary_distance  ◄── NEW                     │
│  8. Spatial separation — push external clusters outward  ◄── NEW    │
│  9. Assemble ActionPoint[] with energy_type  ◄── EXTENDED           │
│ 10. Assemble ClusterInfo[] with boundary_type  ◄── EXTENDED         │
│ 11. Write cache with new top-level fields  ◄── EXTENDED             │
└─────────────────────────────────────────────────────────────────────┘
```

### Frontend Component Tree

```
EnergeiaSchema.tsx
└── EnergeiaMap.tsx                    (extended: passes boundary data)
    ├── EnergyBar.tsx                  ◄── NEW (above canvas, DOM)
    ├── Canvas (R3F)
    │   ├── ActionPointCloud.tsx       (extended: desaturate external points)
    │   ├── CentroidStars.tsx          (unchanged)
    │   ├── MembraneShell.tsx          ◄── NEW (MarchingCubes metaball)
    │   └── SceneControls.tsx          (unchanged)
    └── HoverTooltip.tsx               (unchanged)
```

---

## Components and Interfaces

### `lambda/energeia/lib/bedrockClient.js` — Extended

#### Extended Claude Prompt

The prompt is extended to request three additional fields per cluster response:

1. `boundary_type` — `"internal"` or `"external"` for the cluster as a whole.
2. `action_energy_map` — an object mapping each action title to an **energy weights object** `{ dynamis, oikonomia, techne }` where all three values are non-negative and sum to 1.0.

**New prompt template (replacing `buildClaudePrompt`):**

```
You are analyzing a cluster of organizational actions to infer the emergent role or theme they represent.

Here are all {N} actions in cluster {clusterId}:
1. {title_1}
2. {title_2}
...

Identify the common thread across ALL of these actions.

Also classify the cluster as:
- "internal" if it represents core operations of the organization (e.g. Poultry Care, Agriculture, Food Production, Equipment Maintenance)
- "external" if it represents interactions with outside entities (e.g. Compliance, Government, Vendors, Purchases, Reporting)

Also assign each action an energy weight distribution across three Aristotelian types:
- "dynamis"   — Exploration. Activities that expand capability, revenue, or reach. The Spark.
- "oikonomia" — Exploitation. Activities that sustain existing operations. The Hearth.
- "techne"    — Meta-Policy. Activities that improve how work is done. The Tool.

For each action, return a weight object { "dynamis": 0.0–1.0, "oikonomia": 0.0–1.0, "techne": 0.0–1.0 }
where the three values sum to 1.0. Most actions will have one dominant type but may have meaningful
secondary components (e.g. a training activity might be 0.6 techne, 0.3 dynamis, 0.1 oikonomia).

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "title": "<2-4 word role title>",
  "description": "<one sentence describing what this cluster does>",
  "boundary_type": "internal" | "external",
  "action_energy_map": {
    "<action title 1>": { "dynamis": 0.2, "oikonomia": 0.7, "techne": 0.1 },
    "<action title 2>": { "dynamis": 0.6, "oikonomia": 0.1, "techne": 0.3 }
  }
}
```

**Validation and fallback logic in `labelClusters()`:**

```javascript
// After parsing Claude's JSON response:
const VALID_BOUNDARY_TYPES = new Set(['internal', 'external']);
const DEFAULT_WEIGHTS = { dynamis: 0, oikonomia: 1, techne: 0 };

const boundaryType = VALID_BOUNDARY_TYPES.has(label.boundary_type)
  ? label.boundary_type
  : 'internal';  // Req 2.5, 2.6

const actionEnergyMap = {};
for (const title of cluster.actionTitles) {
  const raw = label.action_energy_map?.[title];
  actionEnergyMap[title] = validateAndNormalizeWeights(raw);  // Req 1.6, 1.7, 1.8
}

/**
 * Validate and normalize an energy weights object from Claude.
 * Returns DEFAULT_WEIGHTS if input is missing or malformed.
 * Clamps negatives to 0, normalizes to sum=1.
 */
function validateAndNormalizeWeights(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEIGHTS };

  const d = Math.max(0, Number(raw.dynamis)   || 0);
  const o = Math.max(0, Number(raw.oikonomia) || 0);
  const t = Math.max(0, Number(raw.techne)    || 0);
  const sum = d + o + t;

  if (sum < 0.01) return { ...DEFAULT_WEIGHTS };  // all zeros — use default

  return {
    dynamis:   d / sum,
    oikonomia: o / sum,
    techne:    t / sum,
  };
}

results.push({
  id: cluster.id,
  title: label.title || `Cluster ${cluster.id}`,
  description: label.description || 'A group of related actions.',
  boundary_type: boundaryType,
  action_energy_map: actionEnergyMap,  // Record<string, { dynamis, oikonomia, techne }>
});
```

**Updated return type:**
```javascript
// Array<{
//   id: number,
//   title: string,
//   description: string,
//   boundary_type: 'internal' | 'external',
//   action_energy_map: Record<string, { dynamis: number, oikonomia: number, techne: number }>
// }>
```

---

### `lambda/energeia/handlers/refresh.js` — Extended

#### Step 8 (label map) — energy_weights lookup

After `labelClusters()` returns, build a title-keyed energy weights map for O(1) lookup when assembling `ActionPoint[]`:

```javascript
// Build a flat title → energy_weights map across all clusters
const titleEnergyMap = new Map(); // actionTitle → { dynamis, oikonomia, techne }
for (const label of clusterLabels) {
  for (const [title, weights] of Object.entries(label.action_energy_map)) {
    titleEnergyMap.set(title, weights);
  }
}

// Helper: derive dominant energy type (argmax) from weights
function dominantEnergyType(weights) {
  const { dynamis, oikonomia, techne } = weights;
  if (dynamis >= oikonomia && dynamis >= techne) return 'dynamis';
  if (techne >= oikonomia) return 'techne';
  return 'oikonomia';
}
```

#### New Step: Compute Center of Mass and Membrane Boundary Distance

Inserted after cluster centroid coords are computed (current step 11), before assembling `ClusterInfo[]`:

```javascript
// Identify internal cluster IDs from label map
const internalClusterIds = new Set(
  clusterLabels
    .filter(l => l.boundary_type === 'internal')
    .map(l => l.id)
);

// Compute center_of_mass = mean of internal cluster centroid positions
let comX = 0, comY = 0, comZ = 0;
let internalCount = 0;
for (const [clusterId, coords] of clusterCoordSums) {
  if (!internalClusterIds.has(clusterId)) continue;
  comX += coords.x / coords.count;
  comY += coords.y / coords.count;
  comZ += coords.z / coords.count;
  internalCount++;
}

let centerOfMass = { x: 0, y: 0, z: 0 };
let membraneBoundaryDistance = 0;

if (internalCount > 0 && internalCount < k) {
  // At least one internal and one external cluster — spatial separation applies
  centerOfMass = { x: comX / internalCount, y: comY / internalCount, z: comZ / internalCount };

  // membrane_boundary_distance = max radial distance from CoM to any internal centroid × 1.5
  let maxInternalRadius = 0;
  for (const [clusterId, coords] of clusterCoordSums) {
    if (!internalClusterIds.has(clusterId)) continue;
    const cx = coords.x / coords.count - centerOfMass.x;
    const cy = coords.y / coords.count - centerOfMass.y;
    const cz = coords.z / coords.count - centerOfMass.z;
    const r = Math.sqrt(cx*cx + cy*cy + cz*cz);
    if (r > maxInternalRadius) maxInternalRadius = r;
  }
  membraneBoundaryDistance = maxInternalRadius * 1.5;
}
// If internalCount === 0 or internalCount === k: skip separation (Req 3.5, 3.6)
```

#### New Step: Spatial Separation Post-Processing

Applied to `normalizedCoords` before assembling `ActionPoint[]`:

```javascript
// Pseudocode — spatial separation
//
// For each external cluster:
//   1. Compute current centroid position (mean of its points in normalizedCoords)
//   2. Compute displacement vector from CoM to centroid
//   3. If centroid is closer than membraneBoundaryDistance, compute push delta
//   4. Apply same delta to every point in that cluster
//
// This preserves intra-cluster relative positions (Req 3.4).

const separatedCoords = [...normalizedCoords]; // shallow copy, will mutate entries

if (membraneBoundaryDistance > 0) {
  for (let clusterId = 0; clusterId < k; clusterId++) {
    if (internalClusterIds.has(clusterId)) continue; // skip internal clusters

    // Current centroid of this external cluster in normalized space
    const coords = clusterCoordSums.get(clusterId);
    if (!coords || coords.count === 0) continue;
    const cx = coords.x / coords.count;
    const cy = coords.y / coords.count;
    const cz = coords.z / coords.count;

    // Displacement vector from CoM to centroid
    const dx = cx - centerOfMass.x;
    const dy = cy - centerOfMass.y;
    const dz = cz - centerOfMass.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist < membraneBoundaryDistance) {
      // Push outward so centroid lands exactly at membraneBoundaryDistance
      const pushFactor = dist > 0
        ? (membraneBoundaryDistance - dist) / dist
        : 0;
      const pushX = dx * pushFactor;
      const pushY = dy * pushFactor;
      const pushZ = dz * pushFactor;

      // Apply same delta to every point in this cluster
      for (let i = 0; i < actionPoints.length; i++) {
        if (labels[i] !== clusterId) continue;
        const [px, py, pz] = separatedCoords[i];
        separatedCoords[i] = [px + pushX, py + pushY, pz + pushZ];
      }
    }
  }
}
```

#### Updated ActionPoint assembly

```javascript
const DEFAULT_WEIGHTS = { dynamis: 0, oikonomia: 1, techne: 0 };

const points = actionPoints.map((ap, i) => {
  const [x, y, z] = separatedCoords[i];  // use separated coords
  const energyWeights = titleEnergyMap.get(ap.actionTitle) ?? DEFAULT_WEIGHTS;
  const energyType = dominantEnergyType(energyWeights);  // argmax for filter system
  return {
    id: `${ap.actionId}::${ap.personId}`,
    action_id: ap.actionId,
    person_id: ap.personId,
    person_name: ap.personName,
    relationship_type: ap.relationshipType,
    cluster_id: labels[i],
    x, y, z,
    bloom_level: ap.bloomLevel,
    action_title: ap.actionTitle,
    status: ap.status,
    observation_count: ap.observationCount,
    energy_weights: energyWeights,  // NEW — { dynamis, oikonomia, techne } summing to 1
    energy_type: energyType,        // NEW — dominant type for filter system
  };
});
```

#### Updated ClusterInfo assembly

```javascript
clusters.push({
  id: clusterId,
  title: label.title,
  description: label.description,
  boundary_type: label.boundary_type,  // NEW
  centroid_x,
  centroid_y,
  centroid_z,
});
```

#### Updated cache payload

```javascript
const payload = {
  k,
  time_window_days: timeWindowDays,
  reduction_method: reductionMethod,
  center_of_mass: centerOfMass,                    // NEW: { x, y, z }
  membrane_boundary_distance: membraneBoundaryDistance,  // NEW: number
  points,    // ActionPoint[] — now includes energy_type
  clusters,  // ClusterInfo[] — now includes boundary_type
};
```

---

### `src/components/EnergeiaSchema/MembraneShell.tsx` — New Component

Renders the metaball implicit surface using `MarchingCubes` from `three/examples/jsm`.

**Key implementation notes:**

- `MarchingCubes` from Three.js examples takes a resolution parameter (grid cells per axis) and a `THREE.Material`. Resolution 28 gives a smooth blob at acceptable GPU cost for the expected 2–12 internal clusters.
- Each internal cluster centroid contributes one metaball sphere. The `addBall(x, y, z, strength, subtract)` API places a sphere of influence. Strength ~0.5 and subtract ~12 (the default isolation value) produces a well-merged blob.
- Coordinates passed to `addBall` must be in `[0, 1]` space — the `MarchingCubes` object is scaled to match the scene's ±20 coordinate range.
- The component is rendered with `renderOrder={-1}` and `depthWrite={false}` so action points and centroid stars always appear in front (Req 4.10).

```tsx
// MembraneShell.tsx — component signature and key logic sketch

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import type { ClusterInfo } from '@/types/energeia';

interface MembraneShellProps {
  clusters: ClusterInfo[];           // full cluster list
  membraneBoundaryDistance: number;  // from cache payload
}

// Coordinate transform: scene space [-RANGE, +RANGE] → MarchingCubes [0, 1]
const SCENE_RANGE = 20;
function toMCSpace(v: number): number {
  return (v + SCENE_RANGE) / (2 * SCENE_RANGE);
}

export function MembraneShell({ clusters, membraneBoundaryDistance }: MembraneShellProps) {
  const { scene } = useThree();
  const mcRef = useRef<MarchingCubes | null>(null);

  const internalClusters = clusters.filter(c => c.boundary_type === 'internal');

  useEffect(() => {
    if (internalClusters.length === 0) return;

    const resolution = 28;
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x00e5ff),   // teal/cyan
      emissive: new THREE.Color(0x006064),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.18,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    const mc = new MarchingCubes(resolution, material, true, true, 100000);
    mc.position.set(0, 0, 0);
    mc.scale.set(SCENE_RANGE * 2, SCENE_RANGE * 2, SCENE_RANGE * 2);
    mc.renderOrder = -1;

    // Place one metaball per internal cluster centroid
    mc.reset();
    for (const cluster of internalClusters) {
      const x = toMCSpace(cluster.centroid_x);
      const y = toMCSpace(cluster.centroid_y);
      const z = toMCSpace(cluster.centroid_z);
      mc.addBall(x, y, z, 0.5, 12);
    }

    scene.add(mc);
    mcRef.current = mc;

    return () => {
      scene.remove(mc);
      mc.geometry.dispose();
      material.dispose();
      mcRef.current = null;
    };
  }, [internalClusters, scene]);

  return null; // imperative Three.js object, no JSX mesh needed
}

export default MembraneShell;
```

**Why imperative rather than declarative R3F JSX?**
`MarchingCubes` is not a standard `THREE.Mesh` — it is a custom `THREE.Object3D` subclass that manages its own geometry buffer. R3F's reconciler cannot create it via `<marchingCubes>` without a custom `extend()` registration. The imperative `useEffect` + `scene.add/remove` pattern is the standard approach for Three.js objects that don't map cleanly to R3F primitives, and is consistent with how `drei`'s `<Stars>` component works internally.

---

### `src/components/EnergeiaSchema/EnergyBar.tsx` — New Component

A DOM-level (non-R3F) horizontal proportional bar rendered above the canvas.

```tsx
// EnergyBar.tsx — component signature and key logic sketch

import type { ActionPoint } from '@/types/energeia';

interface EnergyBarProps {
  points: ActionPoint[];
}

// Segment colors — Aristotelian energy types
// Dynamis: Electric Cyan — "Pure Light", dawn of new value
// Hexis: Indigo — "Density", solid and stable
// Techne: Vibrant Violet/Magenta — "Transformation"
const SEGMENT_COLORS = {
  dynamis: { bg: '#00e5ff', label: 'Dynamis' },
  hexis:   { bg: '#4f46e5', label: 'Hexis' },
  techne:  { bg: '#a855f7', label: 'Techne' },
} as const;

type EnergyType = keyof typeof SEGMENT_COLORS;
const ENERGY_TYPES: EnergyType[] = ['dynamis', 'hexis', 'techne'];

export function EnergyBar({ points }: EnergyBarProps) {
  if (points.length === 0) return null;

  // Weight = observation_count, minimum 1 per point (Req 5.4)
  const weights: Record<EnergyType, number> = {
    dynamis: 0,
    hexis:   0,
    techne:  0,
  };
  for (const point of points) {
    const w = Math.max(1, point.observation_count);
    weights[point.energy_type] += w;
  }
  const total = weights.dynamis + weights.hexis + weights.techne;

  const segments = ENERGY_TYPES.map((type) => ({
    type,
    pct: total > 0 ? (weights[type] / total) * 100 : 0,
    ...SEGMENT_COLORS[type],
  }));

  return (
    <div className="mb-3" aria-label="Energy allocation bar">
      <div className="flex h-7 w-full rounded-md overflow-hidden">
        {segments.map(({ type, pct, bg, label }) =>
          pct > 0 ? (
            <div
              key={type}
              style={{ width: `${pct}%`, backgroundColor: bg }}
              className="flex items-center justify-center overflow-hidden"
              title={`${label}: ${pct.toFixed(1)}%`}
            >
              {pct >= 12 && (
                <span className="text-white text-[11px] font-semibold px-1 truncate">
                  {label} {Math.round(pct)}%
                </span>
              )}
            </div>
          ) : null
        )}
      </div>
      {/* Legend for segments too narrow to show inline label */}
      <div className="flex gap-4 mt-1.5">
        {segments.map(({ type, pct, bg, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: bg }} />
            <span className="text-xs text-muted-foreground">{label} {Math.round(pct)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EnergyBar;
```

---

### `src/components/EnergeiaSchema/EnergeiaMap.tsx` — Extended

Changes:
1. Import and render `<EnergyBar>` above the `<Canvas>` (outside R3F context).
2. Import and render `<EnergyTriangle points={points} />` below the `EnergyBar`, only when `colorMode === 'energy_type'`.
3. Import and render `<MembraneShell>` inside `<Canvas>`, before `<ActionPointCloud>` so depth ordering is correct.
4. Pass `membraneBoundaryDistance` and cluster `boundary_type` data through.
5. Apply desaturation to external action points (Req 4.6) and barycentric blending in energy_type mode (Req 9) — pass `clusters` to `ActionPointCloud`.

```tsx
// EnergeiaMap.tsx — updated props and render structure (sketch)

interface EnergeiaMapProps {
  points: ActionPoint[];
  clusters: ClusterInfo[];
  colorMode: 'cluster' | 'person' | 'accountable' | 'status' | 'energy_type';
  filters: EnergeiaFilters;
  activeEnergyFilter: EnergyType | null;
  onActiveEnergyFilterChange: (type: EnergyType | null) => void;
  onPointClick: (actionId: string) => void;
  membraneBoundaryDistance: number;
}

// Inside render:
// <EnergyBar points={points} ... />
// {colorMode === 'energy_type' && <EnergyTriangle points={points} />}
// Inside Canvas:
// <MembraneShell clusters={clusters} membraneBoundaryDistance={membraneBoundaryDistance} />
// <ActionPointCloud ... clusters={clusters} />
```

---

### `src/components/EnergeiaSchema/ActionPointCloud.tsx` — Extended

Add desaturation for external action points (Req 4.6) and barycentric color blending in `energy_type` mode (Req 9). The `clusters` prop is added so each point can look up its cluster's `boundary_type`:

```tsx
// Barycentric color blend — linear RGB interpolation across three corner colors
// Corner colors in linear RGB (gamma-decoded from hex):
const ENERGY_CORNERS = {
  dynamis:   { r: 0.000, g: 0.898, b: 1.000 },  // #00e5ff
  oikonomia: { r: 0.310, g: 0.275, b: 0.898 },  // #4f46e5
  techne:    { r: 0.659, g: 0.333, b: 0.969 },  // #a855f7
};

function barycentricColor(weights: EnergyWeights): string {
  const { dynamis, oikonomia, techne } = weights;
  const r = dynamis * ENERGY_CORNERS.dynamis.r + oikonomia * ENERGY_CORNERS.oikonomia.r + techne * ENERGY_CORNERS.techne.r;
  const g = dynamis * ENERGY_CORNERS.dynamis.g + oikonomia * ENERGY_CORNERS.oikonomia.g + techne * ENERGY_CORNERS.techne.g;
  const b = dynamis * ENERGY_CORNERS.dynamis.b + oikonomia * ENERGY_CORNERS.oikonomia.b + techne * ENERGY_CORNERS.techne.b;
  // Convert back to hex (clamp to [0,1])
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// In the color computation block:
const clusterBoundaryType = clusters.find(c => c.id === point.cluster_id)?.boundary_type ?? 'internal';
const isExternal = clusterBoundaryType === 'external';

let colorStr: string;
if (isExternal && colorMode !== 'energy_type') {
  colorStr = '#6b7280';  // gray for external in non-energy modes
} else if (colorMode === 'energy_type') {
  // Barycentric blend — always applied in energy_type mode, even for external points
  colorStr = barycentricColor(point.energy_weights);
} else if (colorMode === 'cluster') {
  colorStr = CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length];
} else if (colorMode === 'status') {
  colorStr = STATUS_COLORS[point.status] ?? '#6b7280';
} else {
  colorStr = hashColor(point.person_id);
}

// Emissive matches the blended color so the glow reflects the energy mix (Req 9.9)
const emissiveIntensity = isDimmedByFilter ? 0.02 : (isExternal ? 0.3 : 0.6);
```

---

### `src/components/EnergeiaSchema/EnergyTriangle.tsx` — New Component

A DOM-level ternary diagram rendered as a compact overlay when `colorMode === 'energy_type'`. Shows the three energy types at the triangle corners with a smooth gradient interior, and a crosshair at the global energy average.

```tsx
// EnergyTriangle.tsx — component signature and key logic sketch

import type { ActionPoint, EnergyWeights } from '@/types/energeia';

interface EnergyTriangleProps {
  points: ActionPoint[];  // full unfiltered points for global average
}

// Corner positions in equilateral triangle (normalized 0–1 space):
// Dynamis at top, Oikonomia at bottom-left, Techne at bottom-right
// Barycentric → Cartesian: P = w_d * V_d + w_o * V_o + w_t * V_t
const VERTICES = {
  dynamis:   { x: 0.5,   y: 0.0   },  // top
  oikonomia: { x: 0.0,   y: 1.0   },  // bottom-left
  techne:    { x: 1.0,   y: 1.0   },  // bottom-right
};

function weightsToXY(w: EnergyWeights): { x: number; y: number } {
  return {
    x: w.dynamis * VERTICES.dynamis.x + w.oikonomia * VERTICES.oikonomia.x + w.techne * VERTICES.techne.x,
    y: w.dynamis * VERTICES.dynamis.y + w.oikonomia * VERTICES.oikonomia.y + w.techne * VERTICES.techne.y,
  };
}

export function EnergyTriangle({ points }: EnergyTriangleProps) {
  if (points.length === 0) return null;

  // Compute global average weights (observation-count weighted)
  const totalW = { dynamis: 0, oikonomia: 0, techne: 0 };
  let totalObs = 0;
  for (const p of points) {
    const obs = Math.max(1, p.observation_count);
    totalW.dynamis   += p.energy_weights.dynamis   * obs;
    totalW.oikonomia += p.energy_weights.oikonomia * obs;
    totalW.techne    += p.energy_weights.techne    * obs;
    totalObs += obs;
  }
  const avgWeights: EnergyWeights = {
    dynamis:   totalW.dynamis   / totalObs,
    oikonomia: totalW.oikonomia / totalObs,
    techne:    totalW.techne    / totalObs,
  };
  const crosshair = weightsToXY(avgWeights);

  // Rendered as an SVG with a CSS conic/mesh gradient approximation for the interior.
  // The triangle is 120×104px (equilateral at this scale).
  // Interior gradient: three radial gradients from each corner, blended with mix-blend-mode.
  return (
    <div className="relative" style={{ width: 120, height: 104 }} aria-label="Energy triangle legend">
      <svg width="120" height="104" viewBox="0 0 120 104">
        {/* Gradient defs — one radial per corner */}
        <defs>
          <radialGradient id="grad-dynamis"   cx="50%" cy="0%"   r="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="grad-oikonomia" cx="0%"  cy="100%" r="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="grad-techne"    cx="100%" cy="100%" r="100%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <clipPath id="triangle-clip">
            <polygon points="60,2 2,102 118,102" />
          </clipPath>
        </defs>

        {/* Dark base fill */}
        <polygon points="60,2 2,102 118,102" fill="#0f172a" />

        {/* Layered radial gradients — screen blend for additive color mixing */}
        <g clipPath="url(#triangle-clip)" style={{ mixBlendMode: 'screen' }}>
          <rect width="120" height="104" fill="url(#grad-dynamis)" />
          <rect width="120" height="104" fill="url(#grad-oikonomia)" />
          <rect width="120" height="104" fill="url(#grad-techne)" />
        </g>

        {/* Triangle border */}
        <polygon points="60,2 2,102 118,102" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />

        {/* Crosshair at global average */}
        <circle
          cx={crosshair.x * 116 + 2}
          cy={crosshair.y * 100 + 2}
          r="4"
          fill="white"
          opacity="0.9"
        />
        <line x1={crosshair.x * 116 + 2 - 7} y1={crosshair.y * 100 + 2} x2={crosshair.x * 116 + 2 + 7} y2={crosshair.y * 100 + 2} stroke="white" strokeWidth="1" opacity="0.7" />
        <line x1={crosshair.x * 116 + 2} y1={crosshair.y * 100 + 2 - 7} x2={crosshair.x * 116 + 2} y2={crosshair.y * 100 + 2 + 7} stroke="white" strokeWidth="1" opacity="0.7" />

        {/* Vertex labels */}
        <text x="60" y="0" textAnchor="middle" fill="#00e5ff" fontSize="9" fontWeight="600">Dynamis</text>
        <text x="2"  y="104" textAnchor="start"  fill="#4f46e5" fontSize="9" fontWeight="600">Oikonomia</text>
        <text x="118" y="104" textAnchor="end"   fill="#a855f7" fontSize="9" fontWeight="600">Techne</text>
      </svg>
    </div>
  );
}

export default EnergyTriangle;
```

**Placement:** Rendered below the `EnergyBar` in `EnergeiaMap.tsx`, only when `colorMode === 'energy_type'`.

---

### `src/components/EnergeiaSchema/EnergeiaSchema.tsx` — Extended

Pass `membraneBoundaryDistance` from `data` down to `EnergeiaMap`:

```tsx
<EnergeiaMap
  points={data.points}
  clusters={data.clusters}
  colorMode={colorMode}
  filters={filters}
  onPointClick={handlePointClick}
  membraneBoundaryDistance={data.membrane_boundary_distance}
/>
```

---

## Data Models

### Updated Cache Payload Schema

The JSONB payload stored in `energeia_cache.payload` gains four new fields. All existing fields are preserved unchanged (Req 6.3).

```jsonc
{
  "k": 8,
  "time_window_days": 30,
  "reduction_method": "pca",

  // NEW top-level fields
  "center_of_mass": { "x": 2.4, "y": -1.1, "z": 0.8 },
  "membrane_boundary_distance": 14.7,

  "points": [
    {
      // existing fields — unchanged
      "id": "abc123::user456",
      "action_id": "abc123",
      "person_id": "user456",
      "person_name": "Alice",
      "relationship_type": "assigned",
      "cluster_id": 2,
      "x": 4.2,
      "y": -3.1,
      "z": 1.8,
      "bloom_level": 3,
      "action_title": "Vaccinate laying hens",
      "status": "completed",
      "observation_count": 5,

      // NEW fields
      "energy_weights": { "dynamis": 0.1, "oikonomia": 0.8, "techne": 0.1 },
      "energy_type": "oikonomia"  // argmax of energy_weights — for filter system
    }
  ],

  "clusters": [
    {
      // existing fields — unchanged
      "id": 2,
      "title": "Poultry Care",
      "description": "Actions related to the health and welfare of laying hens.",
      "centroid_x": 3.9,
      "centroid_y": -2.8,
      "centroid_z": 1.5,

      // NEW field
      "boundary_type": "internal"
    }
  ]
}
```

### Updated TypeScript Types (`src/types/energeia.ts`)

```typescript
export type EnergyType = 'dynamis' | 'oikonomia' | 'techne';
export type BoundaryType = 'internal' | 'external';

export interface EnergyWeights {
  dynamis:   number;  // 0.0–1.0
  oikonomia: number;  // 0.0–1.0
  techne:    number;  // 0.0–1.0
  // invariant: dynamis + oikonomia + techne ≈ 1.0
}

export interface ActionPoint {
  id: string;
  action_id: string;
  person_id: string;
  person_name: string;
  relationship_type: 'assigned' | 'participant';
  cluster_id: number;
  x: number;
  y: number;
  z: number;
  bloom_level: number;
  action_title: string;
  status: ActionStatus;
  observation_count: number;
  energy_weights: EnergyWeights;  // NEW — probability distribution across energy types
  energy_type: EnergyType;        // NEW — dominant type (argmax of energy_weights)
}

export interface ClusterInfo {
  id: number;
  title: string;
  description: string;
  centroid_x: number;
  centroid_y: number;
  centroid_z: number;
  boundary_type: BoundaryType;  // NEW
}

export interface EnergeiaSchemaData {
  computed_at: string;
  k: number;
  time_window_days: number;
  reduction_method: 'pca' | 'tsne';
  center_of_mass: { x: number; y: number; z: number };  // NEW
  membrane_boundary_distance: number;                    // NEW
  points: ActionPoint[];
  clusters: ClusterInfo[];
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Claude invocation count equals cluster count

*For any* set of N clusters passed to `labelClusters()`, the function SHALL invoke the Bedrock API exactly N times — once per cluster — regardless of how many action titles each cluster contains.

**Validates: Requirements 1.2, 1.7, 2.2**

---

### Property 2: All classification values are valid after labeling

*For any* set of clusters with any action titles, after `labelClusters()` completes (including when Claude returns missing, null, or invalid values), every returned cluster record SHALL have a `boundary_type` that is one of `['internal', 'external']`, and every value in `action_energy_map` SHALL be an object `{ dynamis, oikonomia, techne }` where all three values are non-negative and sum to 1.0 (within ±0.001 floating-point tolerance).

**Validates: Requirements 1.1, 1.6, 1.7, 1.8, 2.1, 2.5, 2.6**

---

### Property 3: Cache payload preserves all classification fields

*For any* valid refresh pipeline execution (with mocked ML Lambda and Bedrock), every `ActionPoint` in the resulting cache payload SHALL have an `energy_weights` field with non-negative values summing to 1.0, an `energy_type` field equal to the argmax of `energy_weights`, every `ClusterInfo` SHALL have a `boundary_type` field with a valid value, and all pre-existing fields (`id`, `action_id`, `person_id`, `cluster_id`, `x`, `y`, `z`, `bloom_level`, `action_title`, `status`, `observation_count`) SHALL be present and unchanged.

**Validates: Requirements 1.4, 1.5, 2.4, 6.1, 6.2, 6.3, 6.4**

---

### Property 4: Center of mass is the mean of internal centroid positions

*For any* set of internal cluster centroids with positions in 3D space, `computeCenterOfMass()` SHALL return a point whose x, y, and z coordinates each equal the arithmetic mean of the corresponding coordinates of all internal centroids.

**Validates: Requirement 3.1**

---

### Property 5: Membrane boundary distance is max internal radius × 1.5

*For any* set of internal cluster centroids and their computed center of mass, `computeMembraneBoundaryDistance()` SHALL return a value equal to 1.5 times the maximum Euclidean distance from the center of mass to any individual internal centroid.

**Validates: Requirement 3.2**

---

### Property 6: External centroids are at or beyond membrane boundary after separation

*For any* configuration of internal and external clusters (where at least one cluster of each type exists), after spatial separation post-processing, every external cluster centroid SHALL be at a radial distance from the center of mass that is greater than or equal to `membrane_boundary_distance`. Internal cluster centroid positions SHALL be unchanged.

**Validates: Requirement 3.3**

---

### Property 7: Spatial separation applies uniform displacement to all points in an external cluster

*For any* external cluster containing multiple action points, after spatial separation, the displacement vector applied to each action point (i.e., `point_after - point_before`) SHALL equal the displacement vector applied to that cluster's centroid, preserving the relative positions of all points within the cluster.

**Validates: Requirement 3.4**

---

### Property 8: Energy bar proportions are observation-count weighted and sum to 1

*For any* non-empty list of action points with arbitrary `energy_weights` values and `observation_count` values (including zero), the `EnergyBar` component SHALL compute proportions such that: (a) each proportion equals `sum(energy_weights[type] * max(1, observation_count))` for that energy type divided by the total weighted sum across all points and all types, and (b) the three proportions sum to 1.0 (within floating-point tolerance).

**Validates: Requirements 5.3, 5.4**

---

### Property 9: Barycentric color is a valid convex combination of corner colors

*For any* `EnergyWeights` vector where all values are non-negative and sum to 1.0, `barycentricColor(weights)` SHALL return an RGB color that lies within the convex hull of the three corner colors in linear RGB space. Specifically, each channel of the result SHALL equal `w_d * corner_d[channel] + w_o * corner_o[channel] + w_t * corner_t[channel]`.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7**

---

### Property 10: Energy triangle crosshair position is the observation-weighted mean of all point positions

*For any* non-empty list of action points, the crosshair position in the `EnergyTriangle` component SHALL equal the barycentric coordinates computed as `sum(energy_weights[i] * max(1, obs_count[i])) / total_obs` for each energy type, which maps to a Cartesian position via the same `weightsToXY` transform used for individual points.

**Validates: Requirements 10.4**

---

## Error Handling

### Lambda (bedrockClient.js)

| Failure Mode | Handling |
|---|---|
| Claude returns malformed JSON | Existing try/catch in `labelClusters` catches `JSON.parse` error; fallback label returned with `boundary_type: 'internal'` and empty `action_energy_map` |
| Claude omits `boundary_type` | Validated post-parse; defaults to `'internal'` |
| Claude omits action title from `action_energy_map` | Validated per-title; defaults to `{ dynamis: 0, oikonomia: 1, techne: 0 }` |
| Claude returns invalid `boundary_type` value | Set membership check; defaults to `'internal'` |
| Claude returns weights that don't sum to 1.0 | Normalized by dividing each by their sum |
| Claude returns negative weight values | Clamped to 0 before normalization |
| Claude returns all-zero weights | Sum < 0.01 guard; defaults to `{ dynamis: 0, oikonomia: 1, techne: 0 }` |
| Bedrock network error | Existing per-cluster try/catch; fallback label used, pipeline continues |

### Lambda (refresh.js — spatial separation)

| Failure Mode | Handling |
|---|---|
| All clusters are `internal` | `internalCount === k` → skip separation, `membraneBoundaryDistance = 0` |
| All clusters are `external` | `internalCount === 0` → skip separation, `membraneBoundaryDistance = 0` |
| External centroid exactly at CoM (dist = 0) | `pushFactor` guard: if `dist === 0`, no push applied (avoids division by zero) |
| Single internal cluster | CoM = that centroid; `maxInternalRadius = 0`; `membraneBoundaryDistance = 0`; separation skipped gracefully |

### Frontend (MembraneShell.tsx)

| Failure Mode | Handling |
|---|---|
| No internal clusters | Early return `null` — no membrane rendered (Req 4.9) |
| `three/examples/jsm` not available | Import error surfaces at build time; no runtime fallback needed |
| `membraneBoundaryDistance = 0` | Membrane still renders using centroid positions; metaball strength controls blob size independently |

### Frontend (EnergyBar.tsx)

| Failure Mode | Handling |
|---|---|
| Empty points array | Early return `null` — bar not rendered (Req 5.8) |
| All points have `observation_count = 0` | Each contributes weight 1; proportions computed normally |
| Total weight = 0 (impossible given above) | Guard: `total > 0` check before division |

---

## Testing Strategy

### Unit Tests

Focus on specific examples, edge cases, and pure function behavior:

- `buildClaudePrompt()` — verify prompt contains `action_energy_map`, `boundary_type`, all action titles, and correct JSON format instructions
- `labelClusters()` with mocked Bedrock — verify fallback behavior for missing/invalid fields
- `computeCenterOfMass()` — verify mean computation with known inputs
- `computeMembraneBoundaryDistance()` — verify max-radius × 1.5 with known inputs
- Spatial separation — verify all-internal skip, all-external skip, zero-distance guard
- `EnergyBar` — render with empty array (null), render with known distribution (verify percentages), render with all-zero observation counts
- `MembraneShell` — render with no internal clusters (null), render with internal clusters (scene.add called)

### Property-Based Tests

Using [fast-check](https://github.com/dubzzz/fast-check) (already consistent with the TypeScript/Vite stack):

Each property test runs a minimum of 100 iterations.

**Tag format: `Feature: energeia-membrane, Property {N}: {property_text}`**

| Property | Test file | Generator |
|---|---|---|
| P1: Invocation count | `bedrockClient.property.test.ts` | `fc.array(fc.record({ id: fc.nat(), actionTitles: fc.array(fc.string()) }), { minLength: 1, maxLength: 10 })` |
| P2: Valid classification values | `bedrockClient.property.test.ts` | Random clusters + mocked Bedrock returning arbitrary/invalid weight objects |
| P3: Cache payload integrity | `refresh.property.test.ts` | Random action sets with mocked ML Lambda + Bedrock |
| P4: Center of mass | `spatialSeparation.property.test.ts` | `fc.array(fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), { minLength: 1 })` |
| P5: Membrane boundary distance | `spatialSeparation.property.test.ts` | Same generator as P4 |
| P6: External centroids at boundary | `spatialSeparation.property.test.ts` | Random mixed internal/external cluster configs |
| P7: Uniform cluster displacement | `spatialSeparation.property.test.ts` | Random external cluster with multiple points |
| P8: Energy bar proportions | `EnergyBar.property.test.ts` | `fc.array(fc.record({ energy_weights: fc.record({ dynamis: fc.float({min:0,max:1}), oikonomia: fc.float({min:0,max:1}), techne: fc.float({min:0,max:1}) }), observation_count: fc.nat() }), { minLength: 1 })` |
| P9: Barycentric color convex hull | `ActionPointCloud.property.test.ts` | `fc.record({ dynamis: fc.float({min:0,max:1}), oikonomia: fc.float({min:0,max:1}), techne: fc.float({min:0,max:1}) })` (normalized) |
| P10: Triangle crosshair position | `EnergyTriangle.property.test.ts` | Same generator as P8 |

### Integration Tests

- Full `refresh()` handler with real PostgreSQL (test DB) and mocked Bedrock/ML Lambda — verify cache payload shape end-to-end, including `energy_weights` summing to 1.0 and `energy_type` matching argmax
- `GET /api/energeia/schema` — verify response includes `center_of_mass`, `membrane_boundary_distance`, `energy_weights` and `energy_type` on points, `boundary_type` on clusters

### Visual / Manual Tests

- Membrane renders as a single merged blob (not multiple bubbles) when multiple internal clusters are present
- External action points appear visually desaturated compared to internal points in non-energy_type modes
- In `energy_type` mode, nodes show chromatic blends — a mixed action appears as a color between its dominant types
- Energy bar segments are proportionally sized and labeled
- Membrane is semi-transparent and action points are visible through it
- Energy triangle shows a smooth gradient interior and crosshair at the correct global average position
