import { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEnergeiaSchema } from '@/hooks/useEnergeiaSchema';
import type { EnergeiaFilters, EnergyType } from '@/types/energeia';
import { EnergeiaEmptyState } from './EnergeiaEmptyState';
// EnergeiaMap and EnergeiaControls will be implemented in later tasks
import { EnergeiaMap } from './EnergeiaMap';
import { EnergeiaControls } from './EnergeiaControls';

interface EnergeiaSchemaProps {
  startDate: string;
  endDate: string;
  selectedUsers: string[];
}

export function EnergeiaSchema({ startDate, endDate, selectedUsers }: EnergeiaSchemaProps) {
  const { data, isRefreshing, isEmpty, computedAt, refresh } = useEnergeiaSchema();

  const [k, setK] = useState(8);
  const [reductionMethod, setReductionMethod] = useState<'pca' | 'tsne'>('pca');
  const [colorMode, setColorMode] = useState<'cluster' | 'person' | 'accountable' | 'status' | 'energy_type'>('energy_type');
  const [activeEnergyFilter, setActiveEnergyFilter] = useState<EnergyType | null>(null);
  const [filters, setFilters] = useState<EnergeiaFilters>({
    personIds: [],
    relationshipTypes: ['assigned', 'participant'],
    statuses: ['in_progress', 'completed'],
    timeWindowDays: 30,
    sizeMetric: 'observation_count',
  });

  // Once data loads, initialize personIds to all people so the filter is explicit
  useEffect(() => {
    if (!data) return;
    const allIds = Array.from(new Set(data.points.map((p) => p.person_id)));
    setFilters((prev) => ({
      ...prev,
      personIds: prev.personIds.length === 0 ? allIds : prev.personIds,
    }));
  }, [data]);

  const handleRefresh = () => {
    refresh(k, filters.timeWindowDays, reductionMethod);
  };

  const handlePointClick = (actionId: string) => {
    window.location.href = `/actions/${actionId}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>The Energeia Schema</CardTitle>
            {computedAt && (
              <p className="text-sm text-muted-foreground">
                Computed {new Date(computedAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty && !isRefreshing ? (
          <EnergeiaEmptyState />
        ) : (
          <div className="relative">
            {/* Loading spinner overlay — keeps existing visualization visible while refreshing */}
            {isRefreshing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-md">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {data && (
              <>
                <EnergeiaMap
                  points={data.points}
                  clusters={data.clusters}
                  colorMode={colorMode}
                  filters={filters}
                  activeEnergyFilter={activeEnergyFilter}
                  onActiveEnergyFilterChange={setActiveEnergyFilter}
                  onPointClick={handlePointClick}
                  membraneBoundaryDistance={data.membrane_boundary_distance ?? 0}
                />
                <EnergeiaControls
                  k={k}
                  onKChange={setK}
                  reductionMethod={reductionMethod}
                  onReductionMethodChange={setReductionMethod}
                  colorMode={colorMode}
                  onColorModeChange={setColorMode}
                  filters={filters}
                  onFiltersChange={setFilters}
                  points={data.points}
                  clusters={data.clusters}
                  lastComputedK={data.k}
                  lastComputedReductionMethod={data.reduction_method}
                  lastComputedTimeWindowDays={data.time_window_days}
                />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EnergeiaSchema;
