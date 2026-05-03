import { useMemo } from 'react';
import * as THREE from 'three';
import type { ActionPoint, SizeMetric } from '@/types/energeia';

// 12 distinct hues for cluster coloring — exported for legend
export const CLUSTER_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
  '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722',
];

/**
 * Maps bloom_level 1–6 to sphere radius 0.3–0.7.
 * Exported for property tests.
 */
export function bloomToSize(level: number): number {
  return 0.3 + (level / 6) * 0.4;
}

/**
 * Maps observation_count to sphere radius 0.3–0.9.
 * 0 observations → smallest, scales up logarithmically to avoid huge outliers.
 */
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
  colorMode: 'cluster' | 'person' | 'accountable';
  sizeMetric: SizeMetric;
  onHover: (point: ActionPoint | null) => void;
  onPointClick: (actionId: string) => void;
}

/**
 * Renders action points as individual meshes grouped under a <group>.
 * Using individual meshes instead of InstancedMesh avoids the imperative
 * buffer-write timing issues with R3F's reconciler. For the expected scale
 * (~50–500 points) this is perfectly performant.
 */
export function ActionPointCloud({ points, colorMode, sizeMetric, onHover, onPointClick }: ActionPointCloudProps) {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);

  if (points.length === 0) return null;

  return (
    <group>
      {points.map((point, i) => {
        const colorStr =
          colorMode === 'cluster'
            ? CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length]
            : hashColor(point.person_id);
        const size = pointSize(point, sizeMetric);

        return (
          <mesh
            key={`${point.id}-${i}`}
            geometry={geometry}
            position={[point.x, point.y, point.z]}
            scale={size}
            onPointerEnter={(e) => { e.stopPropagation(); onHover(point); }}
            onPointerLeave={(e) => { e.stopPropagation(); onHover(null); }}
            onClick={(e) => { e.stopPropagation(); onPointClick(point.action_id); }}
          >
            <meshStandardMaterial color={colorStr} emissive={colorStr} emissiveIntensity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

export default ActionPointCloud;
