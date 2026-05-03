import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { ActionPoint, ClusterInfo, EnergeiaFilters } from '@/types/energeia';
import { ActionPointCloud } from './ActionPointCloud';
import { CentroidStars } from './CentroidStars';
import { HoverTooltip } from './HoverTooltip';
import { SceneControls } from './SceneControls';

interface EnergeiaMapProps {
  points: ActionPoint[];
  clusters: ClusterInfo[];
  colorMode: 'cluster' | 'person' | 'accountable';
  filters: EnergeiaFilters;
  onPointClick: (actionId: string) => void;
}

export function EnergeiaMap({ points, clusters, colorMode, filters, onPointClick }: EnergeiaMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ActionPoint | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<ClusterInfo | null>(null);

  // Apply filters to points
  const filteredPoints = points.filter((point) => {
    if (!filters.personIds.includes(point.person_id)) return false;
    if (filters.relationshipTypes.length > 0 && !filters.relationshipTypes.includes(point.relationship_type)) {
      return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(point.status)) {
      return false;
    }
    return true;
  });

  return (
    <div className="relative" style={{ height: '600px' }}>
      <Canvas
        camera={{ position: [0, 0, 30], fov: 60 }}
        style={{ background: '#050510', height: '600px' }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={100} depth={50} count={3000} factor={4} fade />
        <ActionPointCloud
          points={filteredPoints}
          colorMode={colorMode}
          sizeMetric={filters.sizeMetric}
          onHover={setHoveredPoint}
          onPointClick={onPointClick}
        />
        <CentroidStars
          clusters={clusters}
          onHover={setHoveredCluster}
        />
        <SceneControls />
      </Canvas>
      <HoverTooltip
        hoveredPoint={hoveredPoint}
        hoveredCluster={hoveredCluster}
        clusters={clusters}
      />
    </div>
  );
}

export default EnergeiaMap;
