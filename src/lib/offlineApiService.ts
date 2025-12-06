import { apiService } from '@/lib/apiService';
import { executeOrQueueMutation } from '@/lib/mutationQueue';

type TableName = 'actions' | 'tools' | 'parts' | 'missions';

interface OfflineMutationOptions {
  table: TableName;
  recordId: string;
  data: any;
  organizationId?: string | null;
}

/**
 * Offline-aware wrapper for write operations.
 *
 * Reads still go through `apiService` directly. Writes use the mutation
 * queue so that changes are persisted locally when offline and synced
 * when connectivity returns.
 */
export const offlineApiService = {
  get: apiService.get.bind(apiService),

  async create<T = any>(
    endpoint: string,
    body: any,
    options: OfflineMutationOptions
  ): Promise<T | null> {
    return executeOrQueueMutation<T>({
      table: options.table,
      type: 'create',
      recordId: options.recordId,
      data: body,
      organizationId: options.organizationId,
      performOnline: () => apiService.post<T>(endpoint, body),
    });
  },

  async update<T = any>(
    endpoint: string,
    body: any,
    options: OfflineMutationOptions
  ): Promise<T | null> {
    return executeOrQueueMutation<T>({
      table: options.table,
      type: 'update',
      recordId: options.recordId,
      data: body,
      organizationId: options.organizationId,
      performOnline: () => apiService.put<T>(endpoint, body),
    });
  },

  async remove<T = any>(
    endpoint: string,
    options: OfflineMutationOptions
  ): Promise<T | null> {
    return executeOrQueueMutation<T>({
      table: options.table,
      type: 'delete',
      recordId: options.recordId,
      data: null,
      organizationId: options.organizationId,
      performOnline: () => apiService.delete<T>(endpoint),
    });
  },
};





