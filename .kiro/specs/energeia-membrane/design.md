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
2. `action_energy_map` — an object mapping each action title to its energy type.

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

Also classify each action by energy type:
- "dynamis" — activities that expand capability, revenue, or reach (Aristotle's concept of potential)
- "hexis" — activities that sustain existing operations (Aristotle's concept of stable disposition)
- "techne" — activities that improve how work is done (Aristotle's concept of craft and skilled making)

Respond with ONLY a JSON object (no markdown, no explanation) in this exact format:
{
  "title": "<2-4 word role title>",
  "description": "<one sentence describing what this cluster does>",
  "boundary_type": "internal" | "external",
  "action_energy_map": {
    "<action title 1>": "dynamis" | "hexis" | "techne",
    "<action title 2>": "dynamis" | "hexis" | "techne"
  }
}
```

**Validation and fallback logic in `labelClusters()`:**

```javascript
// After parsing Claude's JSON response:
const VALID_BOUNDARY_TYPES = new Set(['internal', 'external']);
const VALID_ENERGY_TYPES = new Set(['dynamis', 'hexis', 'techne']);

const boundaryType = VALID_BOUNDARY_TYPES.has(label.boundary_type)
  ? label.boundary_type
  : 'internal';  // Req 2.5, 2.6

const actionEnergyMap = {};
for (const title of cluster.actionTitles) {
  const raw = label.action_energy_map?.[title];
  actionEnergyMap[title] = VALID_ENERGY_TYPES.has(raw) ? raw : 'hexis';  // Req 1.5, 1.6
}

results.push({
  id: cluster.id,
  title: label.title || `Cluster ${cluster.id}`,
  description: label.description || 'A group of related actions.',
  boundary_type: boundaryType,
  action_energy_map: actionEnergyMap,
});
```

**Updated return type:**
```javascript
// Array<{
//   id: number,
//   title: string,
//   description: string,
//   boundary_type: 'internal' | 'external',
//   action_energy_map: Record<string, 'dynamis' | 'hexis' | 'techne'>
// }>
```

---

### `lambda/energeia/handlers/refresh.js` — Extended

#### Step 8 (label map) — energy_type lookup

After `labelClusters()` returns, build a title-keyed energy map for O(1) lookup when assembling `ActionPoint[]`:

```javascript
// Build a flat title → energy_type map across all clusters
const titleEnergyMap = new Map(); // actionTitle → energy_type
for (const label of clusterLabels) {
  for (const [title, energyType] of Object.entries(label.action_energy_map)) {
    titleEnergyMap.set(title, energyType);
  }
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
const points = actionPoints.map((ap, i) => {
  const [x, y, z] = separatedCoords[i];  // use separated coords
  const energyType = titleEnergyMap.get(ap.actionTitle) ?? 'hexis';
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
    energy_type: energyType,  // NEW
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
2. Import and render `<MembraneShell>` inside `<Canvas>`, before `<ActionPointCloud>` so depth ordering is correct.
3. Pass `membraneBoundaryDistance` and cluster `boundary_type` data through.
4. Apply desaturation to external action points (Req 4.6) — pass `clusters` to `ActionPointCloud` so it can determine boundary type per point.

```tsx
// EnergeiaMap.tsx — updated props and render structure (sketch)

interface EnergeiaMapProps {
  points: ActionPoint[];
  clusters: ClusterInfo[];           // ClusterInfo now has boundary_type
  colorMode: 'cluster' | 'person' | 'accountable';
  filters: EnergeiaFilters;
  onPointClick: (actionId: string) => void;
  membraneBoundaryDistance: number;  // NEW — from cache payload
}

// Inside render:
// <EnergyBar points={data.points} />   ← above Canvas, uses full unfiltered points
// Inside Canvas:
// <MembraneShell clusters={clusters} membraneBoundaryDistance={membraneBoundaryDistance} />
// <ActionPointCloud ... clusters={clusters} />   ← clusters passed for boundary_type lookup
```

---

### `src/components/EnergeiaSchema/ActionPointCloud.tsx` — Extended

Add desaturation for external action points (Req 4.6). The `clusters` prop is added so each point can look up its cluster's `boundary_type`:

```tsx
// In the color computation block:
const clusterBoundaryType = clusters.find(c => c.id === point.cluster_id)?.boundary_type ?? 'internal';
const isExternal = clusterBoundaryType === 'external';

// For external points: desaturate by converting to grayscale-ish
const colorStr = isExternal
  ? '#6b7280'  // neutral gray — same for all external points regardless of colorMode
  : (colorMode === 'cluster'
      ? CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length]
      : hashColor(point.person_id));

// Reduce emissive intensity for external points
const emissiveIntensity = isExternal ? 0.1 : 0.6;
```

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

      // NEW field
      "energy_type": "hexis"
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
export type EnergyType = 'dynamis' | 'hexis' | 'techne';
export type BoundaryType = 'internal' | 'external';

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
  energy_type: EnergyType;           // NEW — dynamis | hexis | techne
}

export interface ClusterInfo {
  id: number;
  title: string;
  description: string;
  centroid_x: number;
  centroid_y: number;
  centroid_z: number;
  boundary_type: BoundaryType;       // NEW
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

*For any* set of clusters with any action titles, after `labelClusters()` completes (including when Claude returns missing, null, or invalid values), every returned cluster record SHALL have a `boundary_type` that is one of `['internal', 'external']`, and every value in `action_energy_map` SHALL be one of `['growth', 'maintenance', 'process_improvement']`.

**Validates: Requirements 1.1, 1.5, 1.6, 2.1, 2.5, 2.6**

---

### Property 3: Cache payload preserves all classification fields

*For any* valid refresh pipeline execution (with mocked ML Lambda and Bedrock), every `ActionPoint` in the resulting cache payload SHALL have an `energy_type` field with a valid value, every `ClusterInfo` SHALL have a `boundary_type` field with a valid value, and all pre-existing fields (`id`, `action_id`, `person_id`, `cluster_id`, `x`, `y`, `z`, `bloom_level`, `action_title`, `status`, `observation_count`) SHALL be present and unchanged.

**Validates: Requirements 1.4, 2.4, 6.1, 6.2, 6.3**

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

*For any* non-empty list of action points with arbitrary `energy_type` values and `observation_count` values (including zero), the `EnergyBar` component SHALL compute proportions such that: (a) each proportion equals the sum of `max(1, observation_count)` for that energy type divided by the total weight across all points, and (b) the three proportions sum to 1.0 (within floating-point tolerance). Action points with `observation_count` of zero SHALL contribute a weight of 1 to their energy type segment.

**Validates: Requirements 5.3, 5.4**

---

## Error Handling

### Lambda (bedrockClient.js)

| Failure Mode | Handling |
|---|---|
| Claude returns malformed JSON | Existing try/catch in `labelClusters` catches `JSON.parse` error; fallback label returned with `boundary_type: 'internal'` and empty `action_energy_map` |
| Claude omits `boundary_type` | Validated post-parse; defaults to `'internal'` |
| Claude omits action title from `action_energy_map` | Validated per-title; defaults to `'maintenance'` |
| Claude returns invalid `boundary_type` value | Set membership check; defaults to `'internal'` |
| Claude returns invalid `energy_type` value | Set membership check; defaults to `'maintenance'` |
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
| P2: Valid classification values | `bedrockClient.property.test.ts` | Random clusters + mocked Bedrock returning arbitrary/invalid strings |
| P3: Cache payload integrity | `refresh.property.test.ts` | Random action sets with mocked ML Lambda + Bedrock |
| P4: Center of mass | `spatialSeparation.property.test.ts` | `fc.array(fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), { minLength: 1 })` |
| P5: Membrane boundary distance | `spatialSeparation.property.test.ts` | Same generator as P4 |
| P6: External centroids at boundary | `spatialSeparation.property.test.ts` | Random mixed internal/external cluster configs |
| P7: Uniform cluster displacement | `spatialSeparation.property.test.ts` | Random external cluster with multiple points |
| P8: Energy bar proportions | `EnergyBar.property.test.ts` | `fc.array(fc.record({ energy_type: fc.constantFrom('dynamis','hexis','techne'), observation_count: fc.nat() }), { minLength: 1 })` |

### Integration Tests

- Full `refresh()` handler with real PostgreSQL (test DB) and mocked Bedrock/ML Lambda — verify cache payload shape end-to-end
- `GET /api/energeia/schema` — verify response includes `center_of_mass`, `membrane_boundary_distance`, `energy_type` on points, `boundary_type` on clusters

### Visual / Manual Tests

- Membrane renders as a single merged blob (not multiple bubbles) when multiple internal clusters are present
- External action points appear visually desaturated compared to internal points
- Energy bar segments are proportionally sized and labeled
- Membrane is semi-transparent and action points are visible through it
