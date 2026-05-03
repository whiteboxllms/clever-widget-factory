import type { ActionPoint, ClusterInfo } from '@/types/energeia';
import { ENERGY_TYPE_COLORS } from './ActionPointCloud';

// Legacy map for cached data that still has old names
const LEGACY_ENERGY_LABELS: Record<string, { label: string; color: string }> = {
  growth:              { label: 'Dynamis',   color: '#00e5ff' },
  maintenance:         { label: 'Oikonomia', color: '#4f46e5' },
  hexis:               { label: 'Oikonomia', color: '#4f46e5' },
  process_improvement: { label: 'Techne',    color: '#a855f7' },
};

const ENERGY_LABELS: Record<string, string> = {
  dynamis:   'Dynamis',
  oikonomia: 'Oikonomia',
  techne:    'Techne',
};

function resolveEnergyType(energy_type: string): { label: string; color: string } {
  if (energy_type in ENERGY_TYPE_COLORS) {
    return { label: ENERGY_LABELS[energy_type], color: ENERGY_TYPE_COLORS[energy_type] };
  }
  return LEGACY_ENERGY_LABELS[energy_type] ?? { label: energy_type, color: '#6b7280' };
}

interface HoverTooltipProps {
  hoveredPoint: ActionPoint | null;
  hoveredCluster: ClusterInfo | null;
  clusters: ClusterInfo[];
}

export function buildTooltipContent(
  point: ActionPoint,
  clusters: ClusterInfo[]
): { actionTitle: string; personName: string; clusterTitle: string } {
  const cluster = clusters.find((c) => c.id === point.cluster_id);
  return {
    actionTitle: point.action_title,
    personName: point.person_name,
    clusterTitle: cluster?.title ?? `Cluster ${point.cluster_id}`,
  };
}

const STATUS_STYLES: Record<string, { className: string; label: string }> = {
  completed:   { className: 'bg-green-500/20 text-green-300',  label: 'Completed' },
  in_progress: { className: 'bg-amber-500/20 text-amber-300',  label: 'In Progress' },
  not_started: { className: 'bg-zinc-500/20 text-zinc-400',    label: 'Not Started' },
};

export function HoverTooltip({ hoveredPoint, hoveredCluster, clusters }: HoverTooltipProps) {
  if (!hoveredPoint && !hoveredCluster) {
    return null;
  }

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{ top: 16, right: 16 }}
    >
      <div className="bg-[#050510] border border-white/10 rounded-lg px-3 py-2 shadow-xl max-w-[220px]">
        {hoveredPoint && (() => {
          const { actionTitle, personName, clusterTitle } = buildTooltipContent(
            hoveredPoint,
            clusters
          );
          const energyInfo = resolveEnergyType(hoveredPoint.energy_type);
          const statusStyle = STATUS_STYLES[hoveredPoint.status] ?? { className: 'bg-zinc-500/20 text-zinc-400', label: hoveredPoint.status };
          return (
            <div className="space-y-1">
              <p className="text-white text-sm font-medium leading-snug">{actionTitle}</p>
              <p className="text-white/70 text-xs">{personName}</p>
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${statusStyle.className}`}>
                  {statusStyle.label}
                </span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ backgroundColor: `${energyInfo.color}25`, color: energyInfo.color }}
                >
                  {energyInfo.label}
                </span>
              </div>
              <p className="text-white/50 text-[11px] pt-0.5">{clusterTitle}</p>
            </div>
          );
        })()}

        {hoveredCluster && !hoveredPoint && (
          <div className="space-y-1">
            <p className="text-white text-sm font-semibold leading-snug">{hoveredCluster.title}</p>
            <p className="text-white/60 text-xs leading-relaxed">{hoveredCluster.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HoverTooltip;
