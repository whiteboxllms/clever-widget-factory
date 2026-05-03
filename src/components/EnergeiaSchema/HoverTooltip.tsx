import type { ActionPoint, ClusterInfo } from '@/types/energeia';

interface HoverTooltipProps {
  hoveredPoint: ActionPoint | null;
  hoveredCluster: ClusterInfo | null;
  clusters: ClusterInfo[];
}

export function buildTooltipContent(
  point: ActionPoint,
  clusters: ClusterInfo[]
): { actionTitle: string; personName: string; relationshipType: string; clusterTitle: string } {
  const cluster = clusters.find((c) => c.id === point.cluster_id);
  return {
    actionTitle: point.action_title,
    personName: point.person_name,
    relationshipType: point.relationship_type,
    clusterTitle: cluster?.title ?? `Cluster ${point.cluster_id}`,
  };
}

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
          const { actionTitle, personName, relationshipType, clusterTitle } = buildTooltipContent(
            hoveredPoint,
            clusters
          );
          return (
            <div className="space-y-1">
              <p className="text-white text-sm font-medium leading-snug">{actionTitle}</p>
              <p className="text-white/70 text-xs">{personName}</p>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                    relationshipType === 'assigned'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {relationshipType}
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
