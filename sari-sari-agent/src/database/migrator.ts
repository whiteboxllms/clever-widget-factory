/**
 * Database migration runner with safety procedures
 * Integrates with existing backup and rollback scripts
 */

import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';
import { db } from './connection';
import { DatabaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export interface MigrationResult {
  success: boolean;
  migrationName: string;
  backupFiles: string[];
  executionTime: number;
  error?: string;
}

export interface MigrationStatus {
  migrationName: string;
  appliedAt: Date;
  status: 'applied' | 'rolled_back';
  backupFiles: string[];
}

export class DatabaseMigrator {
  private readonly migrationsDir: string;
  private readonly scriptsDir: string;

  constructor() {
    this.migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    this.scriptsDir = path.join(process.cwd(), 'scripts');
  }

  /**
   * Initialize migration system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure migration history table exists
      await this.createMigrationHistoryTable();
      logger.info('Migration system initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration initialization failed';
      throw new DatabaseError(`Failed to initialize migration system: ${message}`, error as Error);
    }
  }

  /**
   * Create migration history table if it doesn't exist
   */
  private async createMigrationHistoryTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migration_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rollback_script TEXT,
        backup_files JSON,
        status ENUM('applied', 'rolled_back') DEFAULT 'applied',
        execution_time_ms INT,
        INDEX idx_migration_status (status),
        INDEX idx_migration_applied_at (applied_at)
      )
    `;

    await db.query(sql);
    logger.debug('Migration history table ready');
  }

  /**
   * Check if migration has already been applied
   */
  async isMigrationApplied(migrationName: string): Promise<boolean> {
    try {
      const result = await db.query<any[]>(
        'SELECT COUNT(*) as count FROM migration_history WHERE migration_name = ? AND status = "applied"',
        [migrationName]
      );

      return result[0]?.count > 0;
    } catch (error) {
      logger.error('Failed to check migration status', { migrationName, error });
      return false;
    }
  }

  /**
   * Create backup before migration
   */
  private async createBackup(tableName: string): Promise<string> {
    try {
      logger.info('Creating backup before migration', { tableName });
      
      // Use the existing backup script
      const command = `node ${path.join(this.scriptsDir, 'backup-database.js')} ${tableName}`;
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      // Extract backup file path from output
      const backupMatch = output.match(/backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_\w+\.sql\.gz/);
      const backupFile = backupMatch ? backupMatch[0] : '';
      
      if (!backupFile) {
        throw new Error('Could not determine backup file path');
      }
      
      logger.info('Backup created successfully', { tableName, backupFile });
      return path.join(process.cwd(), 'database', 'backups', backupFile);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup creation failed';
      throw new DatabaseError(`Failed to create backup for ${tableName}: ${message}`, error as Error);
    }
  }

  /**
   * Execute a single migration with safety procedures
   */
  async executeMigration(migrationName: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const backupFiles: string[] = [];

    try {
      // Check if already applied
      if (await this.isMigrationApplied(migrationName)) {
        logger.warn('Migration already applied', { migrationName });
        return {
          success: false,
          migrationName,
          backupFiles: [],
          executionTime: 0,
          error: 'Migration already applied'
        };
      }

      // Read migration and rollback files
      const migrationPath = path.join(this.migrationsDir, `${migrationName}.sql`);
      const rollbackPath = path.join(process.cwd(), 'database', 'rollback', `${migrationName}_rollback.sql`);
      
      const migrationSQL = await readFile(migrationPath, 'utf8');
      const rollbackSQL = await readFile(rollbackPath, 'utf8');

      logger.info('Starting migration execution', { migrationName });

      // Create backups for affected tables
      if (migrationSQL.includes('ALTER TABLE products')) {
        const backupFile = await this.createBackup('products');
        backupFiles.push(backupFile);
      }
      
      if (migrationSQL.includes('ALTER TABLE parts')) {
        const backupFile = await this.createBackup('parts');
        backupFiles.push(backupFile);
      }

      // Execute migration in transaction
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      await db.transaction(
        statements.map(sql => ({ sql }))
      );

      // Record migration in history
      await db.query(
        'INSERT INTO migration_history (migration_name, rollback_script, backup_files, execution_time_ms) VALUES (?, ?, ?, ?)',
        [
          migrationName,
          rollbackSQL,
          JSON.stringify(backupFiles),
          Date.now() - startTime
        ]
      );

      // Verify database integrity
      const integrity = await db.verifyIntegrity();
      if (!integrity.success) {
        throw new Error(`Database integrity check failed: ${integrity.issues.join(', ')}`);
      }

      const executionTime = Date.now() - startTime;
      
      logger.info('Migration completed successfully', {
        migrationName,
        executionTime,
        backupFiles: backupFiles.length
      });

      return {
        success: true,
        migrationName,
        backupFiles,
        executionTime
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration execution failed';
      const executionTime = Date.now() - startTime;
      
      logger.error('Migration failed', {
        migrationName,
        executionTime,
        error: message
      });

      return {
        success: false,
        migrationName,
        backupFiles,
        executionTime,
        error: message
      };
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationStatus[]> {
    try {
      const results = await db.query<any[]>(
        'SELECT migration_name, applied_at, status, backup_files FROM migration_history ORDER BY applied_at DESC'
      );

      return results.map(row => ({
        migrationName: row.migration_name,
        appliedAt: new Date(row.applied_at),
        status: row.status,
        backupFiles: JSON.parse(row.backup_files || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get migration history', error);
      return [];
    }
  }

  /**
   * Execute all pending migrations
   */
  async executeAllPendingMigrations(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    
    // Define migration order for MVP
    const migrations = [
      '001_add_sellable_column',
      '002_create_agent_tables',
      '003_add_semantic_search'
    ];

    for (const migration of migrations) {
      const result = await this.executeMigration(migration);
      results.push(result);
      
      if (!result.success) {
        logger.error('Migration failed, stopping execution', { migration });
        break;
      }
    }

    return results;
  }

  /**
   * Verify all required tables and columns exist
   */
  async verifyMigrationState(): Promise<{
    sellableColumnExists: boolean;
    agentTablesExist: boolean;
    semanticSearchReady: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Check sellable column
    const sellableColumnExists = await db.columnExists('parts', 'sellable');
    if (!sellableColumnExists) {
      issues.push('Sellable column missing from parts table');
    }

    // Check agent tables
    const agentTables = ['customers', 'conversation_sessions', 'transactions', 'promotions'];
    const agentTablesExist = await Promise.all(
      agentTables.map(table => db.tableExists(table))
    );
    
    const allAgentTablesExist = agentTablesExist.every(exists => exists);
    if (!allAgentTablesExist) {
      const missingTables = agentTables.filter((_, index) => !agentTablesExist[index]);
      issues.push(`Missing agent tables: ${missingTables.join(', ')}`);
    }

    // Check semantic search components
    const embeddingTextExists = await db.columnExists('parts', 'embedding_text');
    const embeddingVectorExists = await db.columnExists('parts', 'embedding_vector');
    const searchLogsExists = await db.tableExists('search_logs');
    
    const semanticSearchReady = embeddingTextExists && embeddingVectorExists && searchLogsExists;
    if (!semanticSearchReady) {
      const missingComponents = [];
      if (!embeddingTextExists) missingComponents.push('embedding_text column');
      if (!embeddingVectorExists) missingComponents.push('embedding_vector column');
      if (!searchLogsExists) missingComponents.push('search_logs table');
      issues.push(`Missing semantic search components: ${missingComponents.join(', ')}`);
    }

    return {
      sellableColumnExists,
      agentTablesExist: allAgentTablesExist,
      semanticSearchReady,
      issues
    };
  }

  /**
   * Safe migration execution with comprehensive checks
   */
  async executeSafeMigration(migrationName: string): Promise<{
    success: boolean;
    result: MigrationResult;
    preChecks: any;
    postChecks: any;
  }> {
    // Pre-migration checks
    const preChecks = {
      databaseConnected: (await db.healthCheck()).healthy,
      integrityCheck: await db.verifyIntegrity(),
      migrationState: await this.verifyMigrationState()
    };

    logger.info('Pre-migration checks completed', preChecks);

    // Execute migration
    const result = await this.executeMigration(migrationName);

    // Post-migration checks
    const postChecks = {
      databaseConnected: (await db.healthCheck()).healthy,
      integrityCheck: await db.verifyIntegrity(),
      migrationState: await this.verifyMigrationState()
    };

    logger.info('Post-migration checks completed', postChecks);

    return {
      success: result.success && postChecks.integrityCheck.success,
      result,
      preChecks,
      postChecks
    };
  }
}

// Export singleton instance
export const migrator = new DatabaseMigrator();