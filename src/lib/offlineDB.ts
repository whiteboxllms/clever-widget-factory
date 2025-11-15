// Offline-first database using IndexedDB with schema versioning
import Dexie, { Table } from 'dexie';

export interface OfflineRecord {
  id: string;
  data: any;
  table: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  last_modified: number;
  version: number;
  schema_version: number; // Track schema version
}

export interface SyncOperation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  table: string;
  record_id: string;
  data: any;
  timestamp: number;
}

export interface SchemaInfo {
  version: number;
  tables: Record<string, string[]>; // table -> column names
  last_updated: number;
}

class OfflineDatabase extends Dexie {
  records!: Table<OfflineRecord>;
  sync_queue!: Table<SyncOperation>;
  schema_info!: Table<SchemaInfo>;

  private currentSchemaVersion = 1;

  constructor() {
    super('CWFOfflineDB');
    
    // Version 1: Initial schema
    this.version(1).stores({
      records: 'id, table, sync_status, last_modified, schema_version',
      sync_queue: '++id, table, record_id, timestamp',
      schema_info: 'version'
    });

    // Version 2: Add new fields (example for future)
    this.version(2).stores({
      records: 'id, table, sync_status, last_modified, schema_version',
      sync_queue: '++id, table, record_id, timestamp',
      schema_info: 'version'
    }).upgrade(tx => {
      // Migration logic for version 2
      console.log('Migrating to schema version 2');
    });

    this.open().then(() => {
      // Delay schema check to ensure API server is ready
      setTimeout(() => this.checkSchemaVersion(), 2000);
    });
  }

  private async checkSchemaVersion(): Promise<void> {
    try {
      const serverSchema = await this.fetchServerSchema();
      const localSchema = await this.schema_info.get(1);

      if (!localSchema || localSchema.version < serverSchema.version) {
        console.log(`Schema update needed: ${localSchema?.version || 0} -> ${serverSchema.version}`);
        await this.migrateSchema(localSchema, serverSchema);
      }
    } catch (error) {
      console.warn('Schema check failed:', error);
    }
  }

  private async fetchServerSchema(): Promise<SchemaInfo> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add delay for subsequent attempts
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
        const response = await fetch(`${apiBaseUrl}/schema`);
        
        if (!response.ok) {
          throw new Error(`Schema endpoint returned ${response.status}`);
        }
        
        const text = await response.text();
        
        // Check if response is HTML (404 page or dev server error)
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          throw new Error(`Schema endpoint returned HTML instead of JSON (attempt ${attempt}/${maxRetries})`);
        }
        
        return JSON.parse(text);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Schema fetch attempt ${attempt}/${maxRetries} failed:`, error);
        
        // Don't retry on JSON parse errors
        if (error.message.includes('JSON')) {
          break;
        }
      }
    }

    console.warn('All schema fetch attempts failed, using fallback schema');
    // Fallback to current version if all attempts fail
    return {
      version: this.currentSchemaVersion,
      tables: {
        actions: ['id', 'title', 'description', 'assigned_to', 'status'],
        tools: ['id', 'name', 'description', 'category', 'status'],
        parts: ['id', 'name', 'description', 'category'],
        organization_members: ['user_id', 'full_name', 'role']
      },
      last_updated: Date.now()
    };
  }

  private async migrateSchema(oldSchema: SchemaInfo | undefined, newSchema: SchemaInfo): Promise<void> {
    console.log('🔄 Starting schema migration...');

    // Strategy 1: Clear cache and re-sync (safest)
    if (!oldSchema || newSchema.version > oldSchema.version + 1) {
      console.log('Major schema change detected - clearing cache');
      await this.clearAllData();
      await this.schema_info.put(newSchema);
      return;
    }

    // Strategy 2: Incremental migration (for minor changes)
    try {
      await this.performIncrementalMigration(oldSchema, newSchema);
      await this.schema_info.put(newSchema);
      console.log('✅ Schema migration complete');
    } catch (error) {
      console.error('❌ Migration failed, clearing cache:', error);
      await this.clearAllData();
      await this.schema_info.put(newSchema);
    }
  }

  private async performIncrementalMigration(oldSchema: SchemaInfo, newSchema: SchemaInfo): Promise<void> {
    // Example: Handle specific migrations
    if (oldSchema.version === 1 && newSchema.version === 2) {
      // Add new fields to existing records
      await this.records.toCollection().modify(record => {
        record.schema_version = 2;
        // Add any new required fields with defaults
        if (!record.data.new_field) {
          record.data.new_field = null;
        }
      });
    }
  }

  private async clearAllData(): Promise<void> {
    await this.records.clear();
    await this.sync_queue.clear();
    console.log('🗑️ Local cache cleared due to schema change');
  }

  async getTable(tableName: string): Promise<any[]> {
    const records = await this.records
      .where('table')
      .equals(tableName)
      .toArray();
    
    return records.map(r => r.data);
  }

  async putRecord(tableName: string, data: any): Promise<void> {
    const record: OfflineRecord = {
      id: `${tableName}_${data.id}`,
      data,
      table: tableName,
      sync_status: 'synced',
      last_modified: Date.now(),
      version: 1,
      schema_version: this.currentSchemaVersion
    };

    await this.records.put(record);
  }

  async updateRecord(tableName: string, id: string, data: any): Promise<void> {
    const recordId = `${tableName}_${id}`;
    const existing = await this.records.get(recordId);
    
    if (existing) {
      existing.data = { ...existing.data, ...data };
      existing.sync_status = 'pending';
      existing.last_modified = Date.now();
      existing.version += 1;
      existing.schema_version = this.currentSchemaVersion;
      
      await this.records.put(existing);
      
      await this.sync_queue.add({
        type: 'update',
        table: tableName,
        record_id: id,
        data,
        timestamp: Date.now()
      });
    }
  }

  async deleteRecord(tableName: string, id: string): Promise<void> {
    const recordId = `${tableName}_${id}`;
    await this.records.delete(recordId);
    
    await this.sync_queue.add({
      type: 'delete',
      table: tableName,
      record_id: id,
      data: null,
      timestamp: Date.now()
    });
  }

  async getPendingSync(): Promise<SyncOperation[]> {
    return await this.sync_queue.orderBy('timestamp').toArray();
  }

  async clearSyncQueue(): Promise<void> {
    await this.sync_queue.clear();
  }

  // Force schema check (for manual refresh)
  async forceSchemaCheck(): Promise<void> {
    await this.checkSchemaVersion();
  }
}

export const offlineDB = new OfflineDatabase();
