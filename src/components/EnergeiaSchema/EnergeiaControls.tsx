import { useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ActionPoint, ActionStatus, ClusterInfo, EnergeiaFilters } from '@/types/energeia';
import { CLUSTER_COLORS, hashColor } from './ActionPointCloud';

const ALL_STATUSES: ActionStatus[] = ['not_started', 'in_progress', 'completed', 'blocked'];

const STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  blocked: 'Blocked',
};

const TIME_WINDOW_OPTIONS = [
  { value: 7,   label: '7 days' },
  { value: 30,  label: '30 days' },
  { value: 90,  label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

interface EnergeiaControlsProps {
  k: number;
  onKChange: (k: number) => void;
  reductionMethod: 'pca' | 'tsne';
  onReductionMethodChange: (method: 'pca' | 'tsne') => void;
  colorMode: 'cluster' | 'person' | 'accountable';
  onColorModeChange: (mode: 'cluster' | 'person' | 'accountable') => void;
  filters: EnergeiaFilters;
  onFiltersChange: (filters: EnergeiaFilters) => void;
  points: ActionPoint[];
  clusters: ClusterInfo[];
  lastComputedK: number;
  lastComputedReductionMethod: 'pca' | 'tsne';
  lastComputedTimeWindowDays: number;
}

export function EnergeiaControls({
  k,
  onKChange,
  reductionMethod,
  onReductionMethodChange,
  colorMode,
  onColorModeChange,
  filters,
  onFiltersChange,
  points,
  clusters,
  lastComputedK,
  lastComputedReductionMethod,
  lastComputedTimeWindowDays,
}: EnergeiaControlsProps) {
  const uniquePersons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const point of points) {
      if (!seen.has(point.person_id)) seen.set(point.person_id, point.person_name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [points]);

  const legendEntries = useMemo(() => {
    if (colorMode === 'cluster') {
      return clusters.map((c) => ({
        color: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length],
        label: c.title,
      }));
    }
    const seen = new Map<string, string>();
    for (const point of points) {
      if (!seen.has(point.person_id)) seen.set(point.person_id, point.person_name);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      color: hashColor(id),
      label: name,
    }));
  }, [colorMode, clusters, points]);

  const handleRelationshipTypeToggle = (type: 'assigned' | 'participant', checked: boolean) => {
    const updated = checked
      ? ([...filters.relationshipTypes, type] as ('assigned' | 'participant')[])
      : filters.relationshipTypes.filter((t) => t !== type);
    onFiltersChange({ ...filters, relationshipTypes: updated });
  };

  const handleStatusToggle = (status: ActionStatus, checked: boolean) => {
    const updated = checked
      ? ([...filters.statuses, status] as ActionStatus[])
      : filters.statuses.filter((s) => s !== status);
    onFiltersChange({ ...filters, statuses: updated });
  };

  const handlePersonToggle = (personId: string, checked: boolean) => {
    const updated = checked
      ? [...filters.personIds, personId]
      : filters.personIds.filter((id) => id !== personId);
    onFiltersChange({ ...filters, personIds: updated });
  };

  const needsRefresh =
    k !== lastComputedK ||
    reductionMethod !== lastComputedReductionMethod ||
    filters.timeWindowDays !== lastComputedTimeWindowDays;

  return (
    <div className="flex flex-row flex-wrap gap-6 mt-4 p-4 border rounded-md bg-muted/30">

      {/* K Slider */}
      <div className="flex flex-col gap-2 min-w-[180px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Clusters (k): {k}</span>
          {needsRefresh && (
            <span className="text-xs text-amber-600 font-medium">Refresh required</span>
          )}
        </div>
        <Slider
          min={2} max={20} step={1}
          value={[k]}
          onValueChange={([value]) => onKChange(value)}
          className="w-40"
          aria-label="Number of clusters (k)"
        />
      </div>

      {/* Time Window */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Time window</Label>
        <Select
          value={String(filters.timeWindowDays)}
          onValueChange={(v) => onFiltersChange({ ...filters, timeWindowDays: Number(v) })}
        >
          <SelectTrigger className="w-32" aria-label="Time window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_WINDOW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Layout */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Layout</Label>
        <Select
          value={reductionMethod}
          onValueChange={(value) => onReductionMethodChange(value as 'pca' | 'tsne')}
        >
          <SelectTrigger className="w-44" aria-label="Reduction method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pca">PCA — fast, classic</SelectItem>
            <SelectItem value="tsne">t-SNE — local patterns</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Color by */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Color by</Label>
        <Select
          value={colorMode}
          onValueChange={(value) => onColorModeChange(value as 'cluster' | 'person' | 'accountable')}
        >
          <SelectTrigger className="w-44" aria-label="Color mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cluster">Cluster</SelectItem>
            <SelectItem value="person">Person</SelectItem>
            <SelectItem value="accountable">Accountable Person</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Size by */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Size by</Label>
        <Select
          value={filters.sizeMetric}
          onValueChange={(v) => onFiltersChange({ ...filters, sizeMetric: v as EnergeiaFilters['sizeMetric'] })}
        >
          <SelectTrigger className="w-44" aria-label="Size metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="observation_count">Observations</SelectItem>
            <SelectItem value="bloom_level">Bloom level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      {legendEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Legend</span>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {legendEntries.map((entry) => (
              <div key={entry.label} className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground leading-tight">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Status</span>
        <div className="flex flex-col gap-1.5">
          {ALL_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <Checkbox
                id={`status-${status}`}
                checked={filters.statuses.includes(status)}
                onCheckedChange={(checked) => handleStatusToggle(status, checked === true)}
              />
              <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">
                {STATUS_LABELS[status]}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship filter */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Relationship</span>
        <div className="flex flex-col gap-1.5">
          {(['assigned', 'participant'] as const).map((type) => (
            <div key={type} className="flex items-center gap-2">
              <Checkbox
                id={`rel-${type}`}
                checked={filters.relationshipTypes.includes(type)}
                onCheckedChange={(checked) => handleRelationshipTypeToggle(type, checked === true)}
              />
              <Label htmlFor={`rel-${type}`} className="text-sm cursor-pointer capitalize">
                {type}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* People filter */}
      {uniquePersons.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">People</span>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {uniquePersons.map(({ id, name }) => (
              <div key={id} className="flex items-center gap-2">
                <Checkbox
                  id={`person-${id}`}
                  checked={filters.personIds.includes(id)}
                  onCheckedChange={(checked) => handlePersonToggle(id, checked === true)}
                />
                <Label htmlFor={`person-${id}`} className="text-sm cursor-pointer">
                  {name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default EnergeiaControls;
