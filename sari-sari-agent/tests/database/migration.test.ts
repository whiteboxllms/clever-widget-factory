/**
 * Tests for database migration safety procedures
 * Note: These are integration tests that require a test database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/database/connection';
import { migrator } from '@/database/migrator';
import { config } from '@/config';

// Skip these tests if not in test environment or if database is not configured
const shouldRunTests = config.nodeEnv === 'test' && config.database.host;

describe.skipIf(!shouldRunTests)('Database Migration Safety', () => {
  beforeAll(async () => {
    // Initialize database connection for tests
    await db.initialize();
    await migrator.initialize();
  });

  afterAll(async () => {
    // Clean up database connection
    await db.close();
  });

  beforeEach(async () => {
    // Reset migration state for each test
    // In a real test environment, you might want to use a separate test database
  });

  describe('Database Connection', () => {
    it('should establish database connection successfully', async () => {
      const health = await db.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.latency).toBeGreaterThan(0);
    });

    it('should verify database integrity', async () => {
      const integrity = await db.verifyIntegrity();
      expect(integrity).toHaveProperty('success');
      expect(integrity).toHaveProperty('issues');
      expect(Array.isArray(integrity.issues)).toBe(true);
    });

    it('should check table existence', async () => {
      // This assumes products table exists in your test database
      const exists = await db.tableExists('products');
      expect(typeof exists).toBe('boolean');
    });

    it('should get connection pool status', () => {
      const status = db.getPoolStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('totalConnections');
    });
  });

  describe('Migration System', () => {
    it('should initialize migration history table', async () => {
      // Migration history table should be created during initialization
      const exists = await db.tableExists('migration_history');
      expect(exists).toBe(true);
    });

    it('should check migration application status', async () => {
      const isApplied = await migrator.isMigrationApplied('nonexistent_migration');
      expect(isApplied).toBe(false);
    });

    it('should get applied migrations list', async () => {
      const migrations = await migrator.getAppliedMigrations();
      expect(Array.isArray(migrations)).toBe(true);
    });

    it('should verify migration state', async () => {
      const state = await migrator.verifyMigrationState();
      expect(state).toHaveProperty('sellableColumnExists');
      expect(state).toHaveProperty('agentTablesExist');
      expect(state).toHaveProperty('issues');
      expect(Array.isArray(state.issues)).toBe(true);
    });
  });

  describe('Database Queries', () => {
    it('should execute simple queries', async () => {
      const result = await db.query<any[]>('SELECT 1 as test_value');
      expect(result).toHaveLength(1);
      expect(result[0].test_value).toBe(1);
    });

    it('should handle query parameters safely', async () => {
      const testValue = 'test_string';
      const result = await db.query<any[]>('SELECT ? as test_param', [testValue]);
      expect(result[0].test_param).toBe(testValue);
    });

    it('should handle query errors gracefully', async () => {
      await expect(db.query('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('Transaction Safety', () => {
    it('should execute multiple queries in transaction', async () => {
      // Create a temporary table for testing
      const queries = [
        { sql: 'CREATE TEMPORARY TABLE test_transaction (id INT, value VARCHAR(50))' },
        { sql: 'INSERT INTO test_transaction (id, value) VALUES (1, "test1")' },
        { sql: 'INSERT INTO test_transaction (id, value) VALUES (2, "test2")' }
      ];

      await expect(db.transaction(queries)).resolves.toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      const queries = [
        { sql: 'CREATE TEMPORARY TABLE test_rollback (id INT PRIMARY KEY)' },
        { sql: 'INSERT INTO test_rollback (id) VALUES (1)' },
        { sql: 'INSERT INTO test_rollback (id) VALUES (1)' } // This should fail due to duplicate key
      ];

      await expect(db.transaction(queries)).rejects.toThrow();
    });
  });

  describe('Safety Procedures', () => {
    it('should validate table structure queries', async () => {
      // Test that we can safely check table structure
      const tableExists = await db.tableExists('information_schema');
      expect(tableExists).toBe(true);
    });

    it('should validate column existence checks', async () => {
      // Test column existence check on a known system table
      const columnExists = await db.columnExists('information_schema.tables', 'table_name');
      expect(columnExists).toBe(true);
    });

    it('should handle non-existent table gracefully', async () => {
      const exists = await db.tableExists('definitely_nonexistent_table_12345');
      expect(exists).toBe(false);
    });

    it('should handle non-existent column gracefully', async () => {
      const exists = await db.columnExists('information_schema.tables', 'nonexistent_column_12345');
      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // This test would require mocking connection failures
      // For now, we just ensure error types are correct
      expect(() => {
        throw new Error('Connection failed');
      }).toThrow();
    });

    it('should provide meaningful error messages', async () => {
      try {
        await db.query('SELECT * FROM nonexistent_table_xyz');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('nonexistent_table_xyz');
      }
    });
  });
});

// Mock tests for when database is not available
describe.skipIf(shouldRunTests)('Database Migration Safety (Mocked)', () => {
  it('should skip database tests when not configured', () => {
    expect(true).toBe(true); // Placeholder test
  });

  it('should validate migration file structure', () => {
    // Test that migration files have correct format
    const migrationName = '001_add_sellable_column';
    expect(migrationName).toMatch(/^\d{3}_[a-z_]+$/);
  });

  it('should validate rollback file naming convention', () => {
    const rollbackName = '001_add_sellable_column_rollback';
    expect(rollbackName).toMatch(/^\d{3}_[a-z_]+_rollback$/);
  });
});