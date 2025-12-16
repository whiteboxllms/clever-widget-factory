/**
 * Database connection management for RDS integration
 * Handles connection pooling, error handling, and safety procedures
 */

import mysql from 'mysql2/promise';
import { config } from '@/config';
import { DatabaseError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export class DatabaseConnection {
  private pool: mysql.Pool | null = null;
  private isConnected = false;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        connectionLimit: config.database.connectionLimit,
        acquireTimeout: config.database.acquireTimeout,
        timeout: config.database.timeout,
        reconnect: true,
        // Additional safety settings
        multipleStatements: false, // Prevent SQL injection
        dateStrings: false,
        supportBigNumbers: true,
        bigNumberStrings: false
      });

      // Test connection
      await this.testConnection();
      this.isConnected = true;

      logger.info('Database connection pool initialized', {
        host: config.database.host,
        database: config.database.database,
        connectionLimit: config.database.connectionLimit
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      logger.error('Failed to initialize database connection', error);
      throw new DatabaseError(`Database initialization failed: ${message}`, error as Error);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new DatabaseError('Database pool not initialized');
    }

    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      logger.debug('Database connection test successful');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      throw new DatabaseError(`Database connection test failed: ${message}`, error as Error);
    }
  }

  /**
   * Get database connection from pool
   */
  async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool || !this.isConnected) {
      throw new DatabaseError('Database not initialized or not connected');
    }

    try {
      const connection = await this.pool.getConnection();
      return connection;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get connection';
      logger.error('Failed to get database connection', error);
      throw new DatabaseError(`Failed to get database connection: ${message}`, error as Error);
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const connection = await this.getConnection();
    
    try {
      logger.debug('Executing database query', { 
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        paramCount: params?.length || 0
      });

      const [results] = await connection.execute(sql, params);
      return results as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query execution failed';
      logger.error('Database query failed', { sql, error });
      throw new DatabaseError(`Query execution failed: ${message}`, error as Error);
    } finally {
      connection.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(queries: Array<{ sql: string; params?: any[] }>): Promise<T[]> {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      
      logger.debug('Starting database transaction', { queryCount: queries.length });
      
      const results: T[] = [];
      
      for (const query of queries) {
        const [result] = await connection.execute(query.sql, query.params);
        results.push(result as T);
      }
      
      await connection.commit();
      
      logger.debug('Database transaction completed successfully');
      
      return results;
    } catch (error) {
      await connection.rollback();
      const message = error instanceof Error ? error.message : 'Transaction failed';
      logger.error('Database transaction failed, rolled back', error);
      throw new DatabaseError(`Transaction failed: ${message}`, error as Error);
    } finally {
      connection.release();
    }
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.query<any[]>(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        [config.database.database, tableName]
      );
      
      return result[0]?.count > 0;
    } catch (error) {
      logger.error('Failed to check table existence', { tableName, error });
      return false;
    }
  }

  /**
   * Check if a column exists in a table
   */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    try {
      const result = await this.query<any[]>(
        'SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
        [config.database.database, tableName, columnName]
      );
      
      return result[0]?.count > 0;
    } catch (error) {
      logger.error('Failed to check column existence', { tableName, columnName, error });
      return false;
    }
  }

  /**
   * Get table structure information
   */
  async getTableStructure(tableName: string): Promise<any[]> {
    try {
      return await this.query<any[]>('DESCRIBE ??', [tableName]);
    } catch (error) {
      logger.error('Failed to get table structure', { tableName, error });
      throw new DatabaseError(`Failed to get table structure for ${tableName}`, error as Error);
    }
  }

  /**
   * Verify database integrity after changes
   */
  async verifyIntegrity(): Promise<{ success: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check if products table exists
      const productsExists = await this.tableExists('products');
      if (!productsExists) {
        issues.push('Products table does not exist');
      }

      // Check if sellable column exists (if products table exists)
      if (productsExists) {
        const sellableExists = await this.columnExists('products', 'sellable');
        if (!sellableExists) {
          issues.push('Sellable column missing from products table');
        }
      }

      // Test basic query functionality
      if (productsExists) {
        try {
          await this.query('SELECT COUNT(*) as count FROM products LIMIT 1');
        } catch (error) {
          issues.push('Cannot query products table');
        }
      }

      // Check agent tables if they should exist
      const agentTables = ['customers', 'conversation_sessions', 'transactions', 'promotions'];
      for (const table of agentTables) {
        const exists = await this.tableExists(table);
        if (exists) {
          try {
            await this.query(`SELECT COUNT(*) as count FROM ?? LIMIT 1`, [table]);
          } catch (error) {
            issues.push(`Cannot query ${table} table`);
          }
        }
      }

      logger.info('Database integrity check completed', { 
        success: issues.length === 0, 
        issueCount: issues.length 
      });

      return {
        success: issues.length === 0,
        issues
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Integrity check failed';
      issues.push(`Integrity check error: ${message}`);
      
      return {
        success: false,
        issues
      };
    }
  }

  /**
   * Get connection pool status
   */
  getPoolStatus(): {
    connected: boolean;
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
  } | null {
    if (!this.pool) {
      return null;
    }

    return {
      connected: this.isConnected,
      totalConnections: (this.pool as any)._allConnections?.length || 0,
      activeConnections: (this.pool as any)._acquiringConnections?.length || 0,
      idleConnections: (this.pool as any)._freeConnections?.length || 0
    };
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Health check for monitoring
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      await this.query('SELECT 1 as health_check');
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Health check failed';
      
      return {
        healthy: false,
        latency,
        error: message
      };
    }
  }
}

// Singleton instance
export const db = new DatabaseConnection();