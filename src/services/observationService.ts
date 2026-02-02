import { apiService } from '../lib/apiService';
import type { Observation, CreateObservationData } from '../types/observations';

export const observationService = {
  async getObservations(): Promise<Observation[]> {
    return apiService.get('/observations');
  },

  async getObservation(id: string): Promise<Observation> {
    return apiService.get(`/observations/${id}`);
  },

  async createObservation(data: CreateObservationData): Promise<Observation> {
    return apiService.post('/observations', data);
  },

  async updateObservation(id: string, data: Partial<CreateObservationData>): Promise<Observation> {
    return apiService.put(`/observations/${id}`, data);
  },

  async deleteObservation(id: string): Promise<void> {
    return apiService.delete(`/observations/${id}`);
  },
};
