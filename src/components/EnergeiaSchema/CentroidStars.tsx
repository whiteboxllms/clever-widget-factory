import { useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ClusterInfo } from '@/types/energeia';
import { CLUSTER_COLORS } from './ActionPointCloud';

const SPHERE_GEOMETRY = new THREE.SphereGeometry(0.4, 16, 16);

interface CentroidStarsProps {
  clusters: ClusterInfo[];
  onHover: (cluster: ClusterInfo | null) => void;
}

interface CentroidStarProps {
  cluster: ClusterInfo;
  onHover: (cluster: ClusterInfo | null) => void;
}

function CentroidStar({ cluster, onHover }: CentroidStarProps) {
  const [hovered, setHovered] = useState(false);

  const color = CLUSTER_COLORS[cluster.id % CLUSTER_COLORS.length];

  const handlePointerEnter = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    onHover(cluster);
  };

  const handlePointerLeave = () => {
    setHovered(false);
    onHover(null);
  };

  return (
    <mesh
      geometry={SPHERE_GEOMETRY}
      position={[cluster.centroid_x, cluster.centroid_y, cluster.centroid_z]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <meshStandardMaterial
        emissive={color}
        emissiveIntensity={2}
        color={color}
      />
      {hovered && (
        <Html
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(5, 5, 16, 0.85)',
              border: `1px solid ${color}`,
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '12px',
              lineHeight: '1.4',
              maxWidth: '180px',
              whiteSpace: 'normal',
              backdropFilter: 'blur(4px)',
              boxShadow: `0 0 12px ${color}55`,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: '13px',
                marginBottom: '4px',
                color: color,
              }}
            >
              {cluster.title}
            </div>
            <div style={{ color: '#cccccc' }}>{cluster.description}</div>
          </div>
        </Html>
      )}
    </mesh>
  );
}

export function CentroidStars({ clusters, onHover }: CentroidStarsProps) {
  if (clusters.length === 0) return null;

  return (
    <>
      {clusters.map((cluster) => (
        <CentroidStar key={cluster.id} cluster={cluster} onHover={onHover} />
      ))}
    </>
  );
}

export default CentroidStars;
