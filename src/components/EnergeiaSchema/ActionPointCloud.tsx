import { useMemo } from 'react';
import * as THREE from 'three';
import type { ActionPoint, ClusterInfo, EnergyType, EnergyWeights, SizeMetric } from '@/types/energeia';

// 12 distinct hues for cluster coloring — exported for legend
export const CLUSTER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
];

// Person colors — "Bioluminescent Humanism" palette.
// High-chroma neons that pop against the dark background and feel like a
// different frequency of light from the energy spectrum (no purples/cyans/deep blues).
// First 4 are the primary farm team colors; remainder fill additional people.
export const PERSON_COLORS = [
  '#FFD700', // 1. Cyber Gold       (Stefan)
  '#00FF7F', // 2. Spring Green     (Mae)
  '#FF1493', // 3. Deep Pink        (Lester)
  '#FF4500', // 4. Orange Red       (Cher)
  '#ADFF2F', // 5. Green Yellow
  '#FF6347', // 6. Tomato
  '#FFB347', // 7. Pastel Orange
  '#7FFF00', // 8. Chartreuse
  '#FF69B4', // 9. Hot Pink
  '#FFA500', // 10. Orange
  '#DFFF00', // 11. Chartreuse Yellow
  '#FF7F50', // 12. Coral
];

/**
 * Build a stable person_id → color map from an ordered list of person IDs.
 * Colors are assigned by encounter order so the first people get the most
 * visually distinct colors. Exported for use in EnergeiaControls and ActionPointCloud.
 */
export function buildPersonColorMap(personIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  personIds.forEach((id, i) => {
    map.set(id, PERSON_COLORS[i % PERSON_COLORS.length]);
  });
  return map;
}

/**
 * Fallback: assign a color by hashing when no map is available.
 * Used only when the full person list isn't known.
 */
export function personColor(personId: string, colorMap?: Map<string, string>): string {
  if (colorMap?.has(personId)) return colorMap.get(personId)!;
  let hash = 0;
  for (let i = 0; i < personId.length; i++) {
    hash = personId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

// Status colors — exported for legend
export const STATUS_COLORS: Record<string, string> = {
  completed:   '#22c55e',
  in_progress: '#f59e0b',
  not_started: '#6b7280',
};

// Energy type colors — exported for legend and EnergyBar
// Dynamis  (exploration):  Electric Cyan  — The Spark
// Oikonomia (exploitation): Deep Slate/Indigo — The Hearth
// Techne   (meta-policy):  Vibrant Violet  — The Tool
export const ENERGY_TYPE_COLORS: Record<string, string> = {
  dynamis:   '#00e5ff',
  oikonomia: '#4f46e5',
  techne:    '#a855f7',
};

/**
 * Corner colors in linear RGB space (gamma-decoded from hex).
 * Interpolation is done in linear RGB to avoid muddy midpoints (Req 9.7).
 *   Dynamis   #00e5ff → linear (0.000, 0.898, 1.000)
 *   Oikonomia #4f46e5 → linear (0.310, 0.275, 0.898)
 *   Techne    #a855f7 → linear (0.659, 0.333, 0.969)
 */
const ENERGY_CORNERS = {
  dynamis:   { r: 0.000, g: 0.898, b: 1.000 },
  oikonomia: { r: 0.310, g: 0.275, b: 0.898 },
  techne:    { r: 0.659, g: 0.333, b: 0.969 },
} as const;

/**
 * Compute a barycentric color blend of the three energy-type corner colors.
 * Uses the weight vector as barycentric coordinates in linear RGB space.
 * Exported as a pure function for property testing (Req 9.1–9.7).
 *
 * @param weights - EnergyWeights vector (should sum to 1.0)
 * @returns hex color string e.g. "#00e5ff"
 */
export function barycentricColor(weights: EnergyWeights): string {
  const { dynamis, oikonomia, techne } = weights;
  const r = dynamis * ENERGY_CORNERS.dynamis.r + oikonomia * ENERGY_CORNERS.oikonomia.r + techne * ENERGY_CORNERS.techne.r;
  const g = dynamis * ENERGY_CORNERS.dynamis.g + oikonomia * ENERGY_CORNERS.oikonomia.g + techne * ENERGY_CORNERS.techne.g;
  const b = dynamis * ENERGY_CORNERS.dynamis.b + oikonomia * ENERGY_CORNERS.oikonomia.b + techne * ENERGY_CORNERS.techne.b;
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Maps bloom_level 1–6 to sphere radius 0.3–0.7. Exported for property tests. */
export function bloomToSize(level: number): number {
  return 0.3 + (level / 6) * 0.4;
}

/** Maps observation_count to sphere radius 0.3–0.9 (logarithmic). */
export function observationCountToSize(count: number): number {
  if (count <= 0) return 0.3;
  return Math.min(0.9, 0.3 + Math.log2(count + 1) * 0.2);
}

export function pointSize(point: ActionPoint, sizeMetric: SizeMetric): number {
  if (sizeMetric === 'observation_count') return observationCountToSize(point.observation_count);
  return bloomToSize(point.bloom_level);
}

export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

interface ActionPointCloudProps {
  points: ActionPoint[];
  clusters: ClusterInfo[];
  colorMode: 'cluster' | 'person' | 'accountable' | 'status' | 'energy_type';
  sizeMetric: SizeMetric;
  activeEnergyFilter: EnergyType | null;
  personColorMap?: Map<string, string>;
  onHover: (point: ActionPoint | null) => void;
  onPointClick: (actionId: string) => void;
}

export function ActionPointCloud({
  points,
  clusters,
  colorMode,
  sizeMetric,
  activeEnergyFilter,
  personColorMap,
  onHover,
  onPointClick,
}: ActionPointCloudProps) {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);
  const ringGeometry = useMemo(() => new THREE.RingGeometry(1.35, 1.6, 24), []);

  // Legacy map for cached data with old energy type names
  const LEGACY_ENERGY_MAP: Record<string, string> = {
    growth:              'dynamis',
    maintenance:         'oikonomia',
    hexis:               'oikonomia',
    process_improvement: 'techne',
  };

  function resolveEnergyType(energy_type: string): string {
    if (energy_type in ENERGY_TYPE_COLORS) return energy_type;
    return LEGACY_ENERGY_MAP[energy_type] ?? energy_type;
  }

  if (points.length === 0) return null;

  /** Resolve energy weights — use stored weights if present, otherwise synthesize
   *  a degenerate vector from the discrete energy_type for legacy cache data. */
  function resolveWeights(point: ActionPoint): EnergyWeights {
    if (point.energy_weights) return point.energy_weights;
    // Legacy: map discrete type to a degenerate weight vector
    const resolved = resolveEnergyType(point.energy_type);
    return {
      dynamis:   resolved === 'dynamis'   ? 1 : 0,
      oikonomia: resolved === 'oikonomia' ? 1 : 0,
      techne:    resolved === 'techne'    ? 1 : 0,
    };
  }

  return (
    <group>
      {points.map((point, i) => {
        const clusterBoundaryType = clusters.find(c => c.id === point.cluster_id)?.boundary_type ?? 'internal';
        const isExternal = clusterBoundaryType === 'external';

        const resolvedEnergyType = resolveEnergyType(point.energy_type);
        const energyWeights = resolveWeights(point);

        // Energy filter: dim points that don't match the active filter
        const isDimmedByFilter = activeEnergyFilter !== null && resolvedEnergyType !== activeEnergyFilter;
        const isHighlighted = activeEnergyFilter !== null && resolvedEnergyType === activeEnergyFilter;

        // Barycentric blend — always computed, works for both new and legacy cache data
        const energyColor = barycentricColor(energyWeights);

        let colorStr: string;
        if (colorMode === 'cluster') {
          colorStr = CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length];
        } else if (colorMode === 'status') {
          colorStr = STATUS_COLORS[point.status] ?? '#6b7280';
        } else if (colorMode === 'person' || colorMode === 'accountable') {
          colorStr = personColor(point.person_id, personColorMap);
        } else {
          // energy_type mode — full barycentric blend (Req 9.1)
          colorStr = energyColor;
        }

        // External points get reduced emissive intensity so they read as "outside"
        // without losing their color entirely — the membrane provides the separation
        const externalDim = isExternal && colorMode !== 'energy_type';

        // Emissive matches the base color so the glow reinforces the active color mode.
        // In energy_type mode, use the barycentric blend for both color and emissive.
        const emissiveColor = colorStr;

        // Techne-dominant nodes get boosted emissive for bloom pass (energy_type mode only)
        const isTechne = colorMode === 'energy_type' && energyWeights.techne >= 0.5;
        const baseEmissive = isTechne ? 1.8 : (externalDim ? 0.25 : 0.6);
        const emissiveIntensity = isDimmedByFilter ? 0.02 : baseEmissive;
        const opacity = isDimmedByFilter ? 0.15 : 1;
        const size = pointSize(point, sizeMetric);

        // Ring color matches the base color
        const ringColor = colorStr;

        return (
          <group
            key={`${point.id}-${i}`}
            position={[point.x, point.y, point.z]}
          >
            <mesh
              geometry={geometry}
              scale={size}
              onPointerEnter={(e) => { e.stopPropagation(); onHover(point); }}
              onPointerLeave={(e) => { e.stopPropagation(); onHover(null); }}
              onClick={(e) => { e.stopPropagation(); onPointClick(point.action_id); }}
            >
              <meshStandardMaterial
                color={colorStr}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
                transparent={isDimmedByFilter}
                opacity={opacity}
              />
            </mesh>

            {/* Glow halo for Techne-dominant nodes in energy_type mode */}
            {!isDimmedByFilter && isTechne && (
              <mesh geometry={geometry} scale={size * 2.2}>
                <meshBasicMaterial
                  color={colorStr}
                  transparent
                  opacity={0.08}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Ring halo — only shown when this point matches the active energy filter */}
            {isHighlighted && (
              <mesh geometry={ringGeometry} scale={size}>
                <meshBasicMaterial
                  color={ringColor}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default ActionPointCloud;
