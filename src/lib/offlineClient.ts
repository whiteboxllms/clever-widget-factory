// Offline-first API client
import { apiService } from './apiService';
import { offlineDB } from './offlineDB';

class OfflineClient {
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncToServer();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Show loading warning for initial sync
    if (this.isOnline && !localStorage.getItem('offline_db_synced')) {
      this.showSyncWarning();
    }

    // Initial sync if online
    if (this.isOnline) {
      this.syncFromServer();
    }
  }

  private showSyncWarning(): void {
    const warning = document.createElement('div');
    warning.id = 'sync-warning';
    warning.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      background: #f59e0b; color: white; padding: 16px; border-radius: 8px;
      max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, sans-serif; font-size: 14px;
    `;
    warning.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">🔄 Initial Database Sync</div>
      <div>Loading offline database for the first time. This may take 2-3 minutes...</div>
      <div style="margin-top: 8px; font-size: 12px; opacity: 0.9;">
        Future loads will be instant.
      </div>
    `;
    document.body.appendChild(warning);

    // Remove warning after sync completes
    setTimeout(() => {
      const element = document.getElementById('sync-warning');
      if (element) element.remove();
    }, 180000); // 3 minutes max
  }

  async get(table: string, options: any = {}): Promise<{ data: any[]; error: any }> {
    try {
      // Check if we have cached data first
      const cachedData = await offlineDB.getTable(table);
      
      if (this.isOnline && cachedData.length === 0) {
        // Only fetch from server if we have no cached data
        console.log(`📥 Fetching ${table} from server (no cache)...`);
        const result = await apiService.select(table, options);
        
        if (result.data) {
          // Cache all records
          for (const record of result.data) {
            await offlineDB.putRecord(table, record);
          }
        }
        
        return result;
      } else if (cachedData.length > 0) {
        // Return cached data
        console.log(`💾 Using cached ${table} data (${cachedData.length} records)`);
        return { data: cachedData, error: null };
      } else {
        // Offline with no cache
        return { data: [], error: null };
      }
    } catch (error) {
      // Fallback to cache on error
      const data = await offlineDB.getTable(table);
      return { data, error: this.isOnline ? error : null };
    }
  }

  async update(table: string, id: string, data: any): Promise<{ data: any; error: any }> {
    try {
      // Always update local cache first (optimistic update)
      await offlineDB.updateRecord(table, id, data);

      if (this.isOnline) {
        // Try to sync to server
        const result = await apiService.update(table, id, data);
        return result;
      } else {
        // Return success - will sync later
        return { data: { ...data, id }, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  }

  async create(table: string, data: any): Promise<{ data: any; error: any }> {
    try {
      // Generate temporary ID for offline
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const recordWithId = { ...data, id: tempId };

      // Always cache locally first
      await offlineDB.putRecord(table, recordWithId);

      if (this.isOnline) {
        // Try to create on server
        const result = await apiService.insert(table, data);
        
        if (result.data) {
          // Replace temp record with server record
          await offlineDB.deleteRecord(table, tempId);
          await offlineDB.putRecord(table, result.data);
        }
        
        return result;
      } else {
        // Return temp record - will sync later
        return { data: recordWithId, error: null };
      }
    } catch (error) {
      return { data: null, error };
    }
  }

  private async syncFromServer(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      console.log('🔄 Starting initial database sync...');
      
      // Sync core tables with higher limits to reduce API calls
      const tables = [
        { name: 'actions', limit: 1000 },
        { name: 'tools', limit: 1000 },
        { name: 'parts', limit: 1000 },
        { name: 'organization_members', limit: 100 }
      ];
      
      for (const table of tables) {
        console.log(`📥 Syncing ${table.name}...`);
        const result = await apiService.select(table.name, { limit: table.limit });
        
        if (result.data) {
          for (const record of result.data) {
            await offlineDB.putRecord(table.name, record);
          }
          console.log(`✅ Synced ${result.data.length} ${table.name} records`);
        }
      }
      
      // Mark as synced to avoid showing warning again
      localStorage.setItem('offline_db_synced', 'true');
      
      // Remove sync warning
      const warning = document.getElementById('sync-warning');
      if (warning) warning.remove();
      
      console.log('✅ Initial sync from server complete');
    } catch (error) {
      console.error('❌ Sync from server failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncToServer(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const pendingOps = await offlineDB.getPendingSync();
      
      for (const op of pendingOps) {
        try {
          if (op.type === 'update') {
            await apiService.update(op.table, op.record_id, op.data);
          } else if (op.type === 'create') {
            await apiService.insert(op.table, op.data);
          } else if (op.type === 'delete') {
            await apiService.delete(op.table, op.record_id);
          }
        } catch (error) {
          console.error(`Failed to sync ${op.type} for ${op.table}:${op.record_id}`, error);
        }
      }
      
      // Clear sync queue on success
      await offlineDB.clearSyncQueue();
      console.log('✅ Sync to server complete');
    } catch (error) {
      console.error('❌ Sync to server failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  getConnectionStatus(): { online: boolean; syncing: boolean } {
    return {
      online: this.isOnline,
      syncing: this.syncInProgress
    };
  }
}

export const offlineClient = new OfflineClient();
