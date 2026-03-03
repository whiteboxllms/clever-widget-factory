import { apiService } from '../lib/apiService';

export interface MetricSnapshot {
  snapshot_id: string;
  state_id: string;
  metric_id: string;
  value: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSnapshotData {
  metric_id: string;
  value: string;
  notes?: string;
}

export interface UpdateSnapshotData {
  value: string;
  notes?: string;
}

export const snapshotService = {
  async getSnapshots(stateId: string): Promise<MetricSnapshot[]> {
    const response = await apiService.get(`/states/${stateId}/snapshots`);
    return response.snapshots || [];
  },

  async createSnapshot(stateId: string, data: CreateSnapshotData): Promise<MetricSnapshot> {
    const response = await apiService.post(`/states/${stateId}/snapshots`, data);
    return response.snapshot;
  },

  async updateSnapshot(snapshotId: string, data: UpdateSnapshotData): Promise<MetricSnapshot> {
    const response = await apiService.put(`/snapshots/${snapshotId}`, data);
    return response.snapshot;
  },

  async deleteSnapshot(snapshotId: string): Promise<void> {
    await apiService.delete(`/snapshots/${snapshotId}`);
  },
};
