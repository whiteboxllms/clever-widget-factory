import { apiService, getApiData } from '@/lib/apiService';

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

export function useInventoryTracking() {
  const getInventoryTrackingData = async (
    selectedUsers: string[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<InventoryTrackingPoint[]> => {
    try {
      console.log('🟠 getInventoryTrackingData called:', { selectedUsers, startDate, endDate });
      const response = await apiService.get('/parts_history');
      let data = getApiData(response) || [];
      console.log('🟠 Parts history fetched:', data.length);

      data = data.filter((row: any) => row.change_type === 'quantity_remove');

      if (startDate) {
        data = data.filter((row: any) => new Date(row.changed_at) >= new Date(`${startDate}T00:00:00.000Z`));
      }
      if (endDate) {
        data = data.filter((row: any) => new Date(row.changed_at) <= new Date(`${endDate}T23:59:59.999Z`));
      }
      if (selectedUsers && selectedUsers.length > 0) {
        data = data.filter((row: any) => selectedUsers.includes(row.changed_by));
      }
      
      console.log('🟠 After filters:', data.length);

      // Bucket by day, then de-duplicate by part_id, annotating if any entry is action-attached
      const byDay: Map<string, Map<string, { hasAction: boolean }>> = new Map();

      (data || []).forEach((row: any) => {
        const changedAt: string = row.changed_at;
        const dayKey = changedAt.slice(0, 10); // YYYY-MM-DD
        if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
        const perItem = byDay.get(dayKey)!;
        const partId: string = row.part_id;
        const prev = perItem.get(partId) || { hasAction: false };
        const reason: string = row.change_reason || '';
        const isAction = /Used for action:/i.test(reason);
        perItem.set(partId, { hasAction: prev.hasAction || isAction });
      });

      const chart: InventoryTrackingPoint[] = Array.from(byDay.entries())
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

      return chart;
    } catch (err) {
      console.error('Error fetching inventory tracking data:', err);
      return [];
    }
  };

  type HeatmapCell = {
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

  const getInventoryUsageHeatmapData = async (
    selectedUsers: string[] = [],
    startDate?: string,
    endDate?: string
  ): Promise<HeatmapCell[]> => {
    try {
      const response = await apiService.get('/parts_history');
      let data = getApiData(response) || [];

      data = data.filter((row: any) => row.change_type === 'quantity_remove');

      if (startDate) {
        data = data.filter((row: any) => new Date(row.changed_at) >= new Date(`${startDate}T00:00:00.000Z`));
      }
      if (endDate) {
        data = data.filter((row: any) => new Date(row.changed_at) <= new Date(`${endDate}T23:59:59.999Z`));
      }
      if (selectedUsers && selectedUsers.length > 0) {
        data = data.filter((row: any) => selectedUsers.includes(row.changed_by));
      }

    // Build map: personId -> dayKey -> { perPartId hasAction, sizeQuantity }
    const perPersonDay: Map<string, Map<string, { perItem: Map<string, { hasAction: boolean }>; sizeQuantity: number }>> = new Map();
    const personIds: Set<string> = new Set();

    (data || []).forEach((row: any) => {
      const personId = row.changed_by as string;
      const dayKey = (row.changed_at as string).slice(0, 10);
      const partId = row.part_id as string;
      const reason: string = row.change_reason || '';
      const isAction = /Used for action:/i.test(reason);
      const qty = Math.abs(Number(row.quantity_change || 0));
      personIds.add(personId);
      if (!perPersonDay.has(personId)) perPersonDay.set(personId, new Map());
      const dayMap = perPersonDay.get(personId)!;
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, { perItem: new Map(), sizeQuantity: 0 });
      const bucket = dayMap.get(dayKey)!;
      const prev = bucket.perItem.get(partId) || { hasAction: false };
      bucket.perItem.set(partId, { hasAction: prev.hasAction || isAction });
      bucket.sizeQuantity += qty;
    });

    // Resolve person names from organization members
    const membersResponse = await apiService.get('/organization_members');
    const members = getApiData(membersResponse) || [];
    const personNameMap: Record<string, string> = {};
    members.forEach((m: any) => {
      if (m.user_id) personNameMap[m.user_id] = m.full_name || 'Unknown User';
    });
    personIds.forEach(pid => {
      if (!personNameMap[pid]) personNameMap[pid] = 'Unknown User';
    });

    const cells: HeatmapCell[] = [];
    perPersonDay.forEach((days, personId) => {
      days.forEach((bucket, dayKey) => {
        const totalDistinct = bucket.perItem.size;
        let actionCount = 0;
        bucket.perItem.forEach(v => { if (v.hasAction) actionCount++; });
        const directCount = totalDistinct - actionCount;
        const actionPercent = totalDistinct ? (actionCount / totalDistinct) * 100 : 0;
        cells.push({
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
    cells.sort((a, b) => {
      const d = new Date(a.dayKey).getTime() - new Date(b.dayKey).getTime();
      if (d !== 0) return d;
      return a.personName.localeCompare(b.personName);
    });

    return cells;
    } catch (err) {
      console.error('Error fetching heatmap data:', err);
      return [];
    }
  };

  return { getInventoryTrackingData, getInventoryUsageHeatmapData };
}


