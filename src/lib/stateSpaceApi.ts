/**
 * State Space Model API Service
 *
 * API service functions for all state-space model CRUD and association endpoints.
 * Uses the centralized apiService for authenticated requests.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3
 */

import { apiService } from '@/lib/apiService';
import type { StateSpaceModel } from '@/lib/stateSpaceSchema';

// --- Types ---

export interface StateSpaceModelRecord {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  version: string;
  author: string | null;
  model_definition: StateSpaceModel;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StateSpaceModelAssociation {
  id: string;
  model_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export interface CreateStateSpaceModelRequest {
  model_definition: StateSpaceModel;
  is_public?: boolean;
}

export interface UpdateStateSpaceModelRequest {
  model_definition: StateSpaceModel;
  is_public?: boolean;
}

// --- API Functions ---

export async function createStateSpaceModel(
  data: CreateStateSpaceModelRequest
): Promise<{ data: StateSpaceModelRecord }> {
  return apiService.post<{ data: StateSpaceModelRecord }>('/state-space-models', data);
}

export async function listStateSpaceModels(): Promise<{ data: StateSpaceModelRecord[] }> {
  return apiService.get<{ data: StateSpaceModelRecord[] }>('/state-space-models');
}

export async function getStateSpaceModel(
  id: string
): Promise<{ data: StateSpaceModelRecord }> {
  return apiService.get<{ data: StateSpaceModelRecord }>(`/state-space-models/${id}`);
}

export async function updateStateSpaceModel(
  id: string,
  data: UpdateStateSpaceModelRequest
): Promise<{ data: StateSpaceModelRecord }> {
  return apiService.put<{ data: StateSpaceModelRecord }>(`/state-space-models/${id}`, data);
}

export async function deleteStateSpaceModel(
  id: string
): Promise<{ message: string }> {
  return apiService.delete<{ message: string }>(`/state-space-models/${id}`);
}

export async function createModelAssociation(
  modelId: string,
  entityType: string,
  entityId: string
): Promise<{ data: StateSpaceModelAssociation }> {
  return apiService.post<{ data: StateSpaceModelAssociation }>(
    `/state-space-models/${modelId}/associations`,
    { entity_type: entityType, entity_id: entityId }
  );
}

export async function deleteModelAssociation(
  modelId: string,
  associationId: string
): Promise<{ message: string }> {
  return apiService.delete<{ message: string }>(
    `/state-space-models/${modelId}/associations/${associationId}`
  );
}

export async function getModelsByEntity(
  entityType: string,
  entityId: string
): Promise<{ data: StateSpaceModelRecord[] }> {
  return apiService.get<{ data: StateSpaceModelRecord[] }>(
    `/state-space-models/by-entity?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`
  );
}
