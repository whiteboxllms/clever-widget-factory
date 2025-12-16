#!/usr/bin/env node

/**
 * Database Migration Script
 * Safely applies database changes with backup and rollback support
 */

require('dotenv').config({ path: '../.env.local' });
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { createLogicalBackup, verifyTableExists } = require('./backup-database');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
};

const MIGRATIONS_DIR = path.join(__dirname, '../database/migrations');
const ROLLBACK_DIR = path.join(__dirname, '../database/rollback');

async function ensureDirectories() {
  await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
  await fs.mkdir(ROLLBACK_DIR, { recursive: true });
}

async function createMigrationTable() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rollback_script TEXT,
        backup_files JSONB,
        status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back'))
      )
    `);
    
    console.log('✅ Migration history table ready');
  } finally {
    await client.end();
  }
}

async function runMigration(migrationName) {
  const migrationFile = path.join(MIGRATIONS_DIR, `${migrationName}.sql`);
  const rollbackFile = path.join(ROLLBACK_DIR, `${migrationName}_rollback.sql`);
  
  // Check if files exist
  try {
    await fs.access(migrationFile);
  } catch {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  try {
    await fs.access(rollbackFile);
  } catch {
    throw new Error(`Rollback file not found: ${rollbackFile}`);
  }
  
  const client = new Client(DB_CONFIG);
  await client.connect();
  
  try {
    // Check if migration already applied
    const existing = await client.query(
      'SELECT * FROM migration_history WHERE migration_name = $1',
      [migrationName]
    );
    
    if (existing.rows.length > 0) {
      console.log(`⚠️  Migration '${migrationName}' already applied`);
      return;
    }
    
    // Read migration and rollback scripts
    const migrationSQL = await fs.readFile(migrationFile, 'utf8');
    const rollbackSQL = await fs.readFile(rollbackFile, 'utf8');
    
    console.log(`🚀 Applying migration: ${migrationName}`);
    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('');
    
    // Create backups for affected tables (if modifying existing tables)
    const backupFiles = [];
    if (migrationSQL.includes('ALTER TABLE products')) {
      console.log('📦 Creating backup for products table...');
      const backupPath = await createLogicalBackup('products');
      backupFiles.push(backupPath);
    }
    if (migrationSQL.includes('ALTER TABLE parts')) {
      console.log('📦 Creating backup for parts table...');
      const backupPath = await createLogicalBackup('parts');
      backupFiles.push(backupPath);
    }
    
    // Start transaction
    await client.query('BEGIN');
    
    try {
      // Execute migration
      const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.trim().substring(0, 100)}...`);
          await client.query(statement);
        }
      }
      
      // Record migration in history
      await client.query(
        'INSERT INTO migration_history (migration_name, rollback_script, backup_files) VALUES ($1, $2, $3)',
        [migrationName, rollbackSQL, JSON.stringify(backupFiles)]
      );
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`✅ Migration '${migrationName}' applied successfully`);
      
      // Verify database integrity
      await verifyDatabaseIntegrity(client);
      
    } catch (error) {
      // Rollback transaction
      await client.query('ROLLBACK');
      throw error;
    }
    
  } finally {
    await client.end();
  }
}

async function verifyDatabaseIntegrity(client) {
  console.log('🔍 Verifying database integrity...');
  
  try {
    // Check if parts table exists and has expected structure
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parts'"
    );
    
    if (tables.rows.length === 0) {
      throw new Error('Parts table not found after migration');
    }
    
    // Check if sellable column exists (if this is the parts migration)
    const columns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'parts' AND column_name = 'sellable'"
    );
    
    if (columns.rows.length > 0) {
      console.log('✅ Sellable column added successfully');
      
      // Test a simple query
      const testQuery = await client.query(
        'SELECT COUNT(*) as count FROM parts WHERE sellable = true'
      );
      
      console.log(`✅ Database query test passed. Sellable parts: ${testQuery.rows[0].count}`);
    }
    
    console.log('✅ Database integrity verified');
    
  } catch (error) {
    console.error('❌ Database integrity check failed:', error.message);
    throw error;
  }
}

async function main() {
  const migrationName = process.argv[2];
  
  if (!migrationName) {
    console.error('Usage: node migrate-database.js <migration_name>');
    console.error('Example: node migrate-database.js 001_add_sellable_column');
    process.exit(1);
  }
  
  try {
    await ensureDirectories();
    await createMigrationTable();
    await runMigration(migrationName);
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('⚠️  IMPORTANT: Please verify that existing farm applications still work correctly');
    console.log('⚠️  Test all critical functionality before proceeding');
    console.log('');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('🔄 To rollback, run: npm run db:rollback', migrationName);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runMigration,
  verifyDatabaseIntegrity
};