import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ActionPoint, ClusterInfo } from '@/types/energeia';

interface VelocityStreaksProps {
  points: ActionPoint[];
  clusters: ClusterInfo[];
}

// Streak length and fade segments
const STREAK_SEGMENTS = 6;
const STREAK_LENGTH = 2.2;

export function VelocityStreaks({ points, clusters }: VelocityStreaksProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Only in_progress points get streaks
  const inProgressPoints = useMemo(
    () => points.filter(p => p.status === 'in_progress'),
    [points]
  );

  // Compute the center of mass of internal clusters — streaks point away from it
  // (comet tail trails behind the direction of travel toward center)
  const centerOfMass = useMemo(() => {
    const internal = clusters.filter(c => c.boundary_type === 'internal');
    if (internal.length === 0) return new THREE.Vector3(0, 0, 0);
    const cx = internal.reduce((s, c) => s + c.centroid_x, 0) / internal.length;
    const cy = internal.reduce((s, c) => s + c.centroid_y, 0) / internal.length;
    const cz = internal.reduce((s, c) => s + c.centroid_z, 0) / internal.length;
    return new THREE.Vector3(cx, cy, cz);
  }, [clusters]);

  const streakData = useMemo(() => {
    return inProgressPoints.map(point => {
      const pos = new THREE.Vector3(point.x, point.y, point.z);
      // Direction from point away from center = tail direction
      const toCenter = new THREE.Vector3().subVectors(centerOfMass, pos);
      const dist = toCenter.length();
      const tailDir = dist > 0.01
        ? toCenter.clone().normalize().negate()  // tail points away from center
        : new THREE.Vector3(0, 1, 0);

      // Build streak positions: from point outward along tail direction
      const positions: number[] = [];
      for (let s = 0; s <= STREAK_SEGMENTS; s++) {
        const t = s / STREAK_SEGMENTS;
        const p = pos.clone().addScaledVector(tailDir, t * STREAK_LENGTH);
        positions.push(p.x, p.y, p.z);
      }

      // Alpha fades from 0.6 at head to 0 at tail
      const alphas = Array.from({ length: STREAK_SEGMENTS + 1 }, (_, s) =>
        (1 - s / STREAK_SEGMENTS) * 0.6
      );

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

      return { geo, alphas, point };
    });
  }, [inProgressPoints, centerOfMass]);

  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  if (streakData.length === 0) return null;

  return (
    <group ref={groupRef}>
      {streakData.map(({ geo, point }) => (
        <line key={point.id} geometry={geo}>
          <lineBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.45}
            linewidth={1}
          />
        </line>
      ))}
    </group>
  );
}

export default VelocityStreaks;
