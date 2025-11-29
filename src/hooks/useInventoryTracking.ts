import { apiService, getApiData } from '@/lib/apiService';
import type { OrganizationMemberSummary } from '@/types/organization';

export interface InventoryTrackingPoint {
  name: string;
  actionAttached: number; // percent 0-100
  direct: number; // percent 0-100
  totalDistinctItems: number;
  actionCount: number; // distinct items with any action-attached reduction
  directCount: number; // distinct items with only direct reductions
  dayKey: string; // YYYY-MM-DD
}

function formatMMDD(dayKey: string): string {
  const date = new Date(dayKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

type PartsHistoryRow = {
  changed_at: string;
  change_type: string;
  changed_by: string;
  part_id: string;
  change_reason?: string | null;
  quantity_change?: number | string;
};

const buildPersonNameMap = (members?: OrganizationMemberSummary[]) => {
  const map: Record<string, string> = {};
  (members || []).forEach(member => {
    if (member.user_id) {
      map[member.user_id] = member.full_name || 'Unknown User';
    }
  });
  return map;
};

export type HeatmapCell = {
  personId: string;
  personName: string;
  dayKey: string;
  name: string; // MM/DD
  actionPercent: number;
  totalDistinct: number;
  actionCount: number;
  directCount: number;
  sizeQuantity: number; // sum of absolute quantity_change that day/person
};

export type InventoryData = {
  chartData: InventoryTrackingPoint[];
  heatmapData: HeatmapCell[];
};

export function useInventoryTracking(organizationMembers?: OrganizationMemberSummary[]) {
  const cachedNameMap = buildPersonNameMap(organizationMembers);

  const fetchInventoryData = async (
    selectedUsers: string[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<InventoryData> => {
    try {
      // Request more records and filter by change_type on server side
      const params = new URLSearchParams({ 
        change_type: 'quantity_remove',
        limit: '1000'
      });
      const response = await apiService.get(`/parts_history?${params.toString()}`);
      let data = (getApiData(response) || []) as PartsHistoryRow[];
      
      // Filter already applied on server, but keep this for safety
      data = data.filter((row) => row.change_type === 'quantity_remove');

      data = data.filter((row) => row.change_type === 'quantity_remove');

      if (startDate) {
        data = data.filter((row) => new Date(row.changed_at) >= new Date(`${startDate}T00:00:00.000Z`));
      }
      if (endDate) {
        data = data.filter((row) => new Date(row.changed_at) <= new Date(`${endDate}T23:59:59.999Z`));
      }
      if (selectedUsers && selectedUsers.length > 0) {
        data = data.filter((row) => selectedUsers.includes(row.changed_by));
      }

      // Process for chart: bucket by day, then de-duplicate by part_id
      const byDay: Map<string, Map<string, { hasAction: boolean }>> = new Map();

      // Process for heatmap: personId -> dayKey -> { perPartId hasAction, sizeQuantity }
      const perPersonDay: Map<string, Map<string, { perItem: Map<string, { hasAction: boolean }>; sizeQuantity: number }>> = new Map();
      const personIds: Set<string> = new Set();

      (data || []).forEach((row) => {
        const changedAt: string = row.changed_at;
        const dayKey = changedAt.slice(0, 10); // YYYY-MM-DD
        const partId: string = row.part_id;
        const reason: string = row.change_reason || '';
        const isAction = /Used for action:/i.test(reason);
        const personId = row.changed_by as string;
        const qty = Math.abs(Number(row.quantity_change || 0));

        // Chart processing
        if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
        const perItem = byDay.get(dayKey)!;
        const prev = perItem.get(partId) || { hasAction: false };
        perItem.set(partId, { hasAction: prev.hasAction || isAction });

        // Heatmap processing
        personIds.add(personId);
        if (!perPersonDay.has(personId)) perPersonDay.set(personId, new Map());
        const dayMap = perPersonDay.get(personId)!;
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, { perItem: new Map(), sizeQuantity: 0 });
        const bucket = dayMap.get(dayKey)!;
        const heatmapPrev = bucket.perItem.get(partId) || { hasAction: false };
        bucket.perItem.set(partId, { hasAction: heatmapPrev.hasAction || isAction });
        bucket.sizeQuantity += qty;
      });

      // Build chart data
      const chartData: InventoryTrackingPoint[] = Array.from(byDay.entries())
        .map(([dayKey, perItem]) => {
          const total = perItem.size;
          let action = 0;
          perItem.forEach((v) => {
            if (v.hasAction) action++;
          });
          const direct = total - action;
          return {
            name: formatMMDD(dayKey),
            actionAttached: total ? (action / total) * 100 : 0,
            direct: total ? (direct / total) * 100 : 0,
            totalDistinctItems: total,
            actionCount: action,
            directCount: direct,
            dayKey,
          };
        })
        .sort((a, b) => new Date(a.dayKey).getTime() - new Date(b.dayKey).getTime());

      // Build heatmap data
      const personNameMap = { ...cachedNameMap };
      personIds.forEach(pid => {
        if (!personNameMap[pid]) personNameMap[pid] = 'Unknown User';
      });

      const heatmapData: HeatmapCell[] = [];
      perPersonDay.forEach((days, personId) => {
        days.forEach((bucket, dayKey) => {
          const totalDistinct = bucket.perItem.size;
          let actionCount = 0;
          bucket.perItem.forEach(v => { if (v.hasAction) actionCount++; });
          const directCount = totalDistinct - actionCount;
          const actionPercent = totalDistinct ? (actionCount / totalDistinct) * 100 : 0;
          heatmapData.push({
            personId,
            personName: personNameMap[personId] || 'Unknown User',
            dayKey,
            name: formatMMDD(dayKey),
            actionPercent,
            totalDistinct,
            actionCount,
            directCount,
            sizeQuantity: bucket.sizeQuantity,
          });
        });
      });

      // Sort by day then by person name for stable rendering
      heatmapData.sort((a, b) => {
        const d = new Date(a.dayKey).getTime() - new Date(b.dayKey).getTime();
        if (d !== 0) return d;
        return a.personName.localeCompare(b.personName);
      });

      return { chartData, heatmapData };
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      return { chartData: [], heatmapData: [] };
    }
  };

  // Legacy functions for backward compatibility (now just call fetchInventoryData)
  const getInventoryTrackingData = async (
    selectedUsers: string[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<InventoryTrackingPoint[]> => {
    const result = await fetchInventoryData(selectedUsers, startDate, endDate);
    return result.chartData;
  };

  const getInventoryUsageHeatmapData = async (
    selectedUsers: string[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<HeatmapCell[]> => {
    const result = await fetchInventoryData(selectedUsers, startDate, endDate);
    return result.heatmapData;
  };

  return { 
    fetchInventoryData,
    getInventoryTrackingData, 
    getInventoryUsageHeatmapData 
  };
}


