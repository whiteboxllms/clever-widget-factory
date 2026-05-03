import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { ActionPoint, ClusterInfo, EnergeiaFilters, EnergyType } from '@/types/energeia';
import { ActionPointCloud } from './ActionPointCloud';
import { CentroidStars } from './CentroidStars';
import { HoverTooltip } from './HoverTooltip';
import { MembraneShell } from './MembraneShell';
import { EnergyBar } from './EnergyBar';
import { SceneControls } from './SceneControls';
import { VelocityStreaks } from './VelocityStreaks';
import { OikonomiaBackground } from './OikonomiaBackground';

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

export function EnergeiaMap({
  points,
  clusters,
  colorMode,
  filters,
  activeEnergyFilter,
  onActiveEnergyFilterChange,
  onPointClick,
  membraneBoundaryDistance,
}: EnergeiaMapProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ActionPoint | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<ClusterInfo | null>(null);

  const filteredPoints = points.filter((point) => {
    if (!filters.personIds.includes(point.person_id)) return false;
    if (filters.relationshipTypes.length > 0 && !filters.relationshipTypes.includes(point.relationship_type)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(point.status)) return false;
    return true;
  });

  return (
    <div>
      {/* Energy bar uses full unfiltered points — always reflects the org-wide picture */}
      <EnergyBar
        points={points}
        activeEnergyFilter={activeEnergyFilter}
        onSegmentClick={onActiveEnergyFilterChange}
      />

      <div className="relative" style={{ height: '600px' }}>
        <Canvas
          camera={{ position: [0, 0, 30], fov: 60 }}
          style={{ height: '600px' }}
          gl={{ antialias: true, toneMapping: 4 /* ACESFilmicToneMapping */ }}
        >
          {/* Oikonomia: ambient light + background color shift based on energy ratios */}
          <OikonomiaBackground points={points} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Stars radius={100} depth={50} count={3000} factor={4} fade />

          <MembraneShell clusters={clusters} />

          <ActionPointCloud
            points={filteredPoints}
            clusters={clusters}
            colorMode={colorMode}
            sizeMetric={filters.sizeMetric}
            activeEnergyFilter={activeEnergyFilter}
            onHover={setHoveredPoint}
            onPointClick={onPointClick}
          />

          {/* Velocity streaks — comet tails on in_progress points */}
          <VelocityStreaks points={filteredPoints} clusters={clusters} />

          <CentroidStars clusters={clusters} onHover={setHoveredCluster} />
          <SceneControls />
        </Canvas>
        <HoverTooltip
          hoveredPoint={hoveredPoint}
          hoveredCluster={hoveredCluster}
          clusters={clusters}
        />
      </div>
    </div>
  );
}

export default EnergeiaMap;
