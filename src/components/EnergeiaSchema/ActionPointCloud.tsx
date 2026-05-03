import { useMemo } from 'react';
import * as THREE from 'three';
import type { ActionPoint, ClusterInfo, EnergyType, SizeMetric } from '@/types/energeia';

// 12 distinct hues for cluster coloring — exported for legend
export const CLUSTER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
];

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
  onHover: (point: ActionPoint | null) => void;
  onPointClick: (actionId: string) => void;
}

export function ActionPointCloud({
  points,
  clusters,
  colorMode,
  sizeMetric,
  activeEnergyFilter,
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

  return (
    <group>
      {points.map((point, i) => {
        const clusterBoundaryType = clusters.find(c => c.id === point.cluster_id)?.boundary_type ?? 'internal';
        const isExternal = clusterBoundaryType === 'external';

        const resolvedEnergyType = resolveEnergyType(point.energy_type);

        // Energy filter: dim points that don't match the active filter
        const isDimmedByFilter = activeEnergyFilter !== null && resolvedEnergyType !== activeEnergyFilter;
        const isHighlighted = activeEnergyFilter !== null && resolvedEnergyType === activeEnergyFilter;

        let colorStr: string;
        if (isExternal && colorMode !== 'energy_type') {
          // Gray out external points in all modes except energy_type,
          // where the energy classification should always be visible
          colorStr = '#6b7280';
        } else if (colorMode === 'cluster') {
          colorStr = CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length];
        } else if (colorMode === 'status') {
          colorStr = STATUS_COLORS[point.status] ?? '#6b7280';
        } else if (colorMode === 'energy_type') {
          colorStr = ENERGY_TYPE_COLORS[resolvedEnergyType] ?? '#6b7280';
        } else {
          colorStr = hashColor(point.person_id);
        }

        // Techne nodes get boosted emissive for bloom pass
        const isTechne = resolvedEnergyType === 'techne';
        const baseEmissive = isTechne ? 1.8 : (isExternal ? 0.3 : 0.6);
        const emissiveIntensity = isDimmedByFilter ? 0.02 : baseEmissive;
        const opacity = isDimmedByFilter ? 0.15 : 1;
        const size = pointSize(point, sizeMetric);

        // Ring color matches the energy type segment color
        const ringColor = ENERGY_TYPE_COLORS[resolvedEnergyType] ?? '#ffffff';

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
                emissive={colorStr}
                emissiveIntensity={emissiveIntensity}
                transparent={isDimmedByFilter}
                opacity={opacity}
              />
            </mesh>

            {/* Glow halo for Techne nodes — larger transparent sphere simulates bloom */}
            {!isDimmedByFilter && resolvedEnergyType === 'techne' && (
              <mesh geometry={geometry} scale={size * 2.2}>
                <meshBasicMaterial
                  color="#a855f7"
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
