#!/usr/bin/env node

/**
 * Database Rollback Script
 * Safely reverts database changes using stored rollback scripts
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farm_db'
};

async function rollbackMigration(migrationName) {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    // Get migration history
    const [migrations] = await connection.execute(
      'SELECT * FROM migration_history WHERE migration_name = ? AND status = "applied"',
      [migrationName]
    );
    
    if (migrations.length === 0) {
      console.log(`⚠️  Migration '${migrationName}' not found or already rolled back`);
      return;
    }
    
    const migration = migrations[0];
    const rollbackSQL = migration.rollback_script;
    const backupFiles = JSON.parse(migration.backup_files || '[]');
    
    console.log(`🔄 Rolling back migration: ${migrationName}`);
    console.log('Rollback SQL:');
    console.log(rollbackSQL);
    console.log('');
    
    // Confirm rollback
    console.log('⚠️  This will revert database changes. Continue? (y/N)');
    
    // In production, you might want to require explicit confirmation
    // For now, we'll proceed automatically but log the action
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Execute rollback statements
      const statements = rollbackSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Executing: ${statement.trim().substring(0, 100)}...`);
          await connection.execute(statement);
        }
      }
      
      // Update migration history
      await connection.execute(
        'UPDATE migration_history SET status = "rolled_back" WHERE migration_name = ?',
        [migrationName]
      );
      
      // Commit transaction
      await connection.commit();
      
      console.log(`✅ Migration '${migrationName}' rolled back successfully`);
      
      // Verify rollback
      await verifyRollback(connection, migrationName);
      
    } catch (error) {
      // Rollback transaction
      await connection.rollback();
      
      console.error('❌ Rollback failed, attempting to restore from backup...');
      
      // Attempt to restore from backup if available
      if (backupFiles.length > 0) {
        await restoreFromBackup(backupFiles[0]);
      }
      
      throw error;
    }
    
  } finally {
    await connection.end();
  }
}

async function verifyRollback(connection, migrationName) {
  console.log('🔍 Verifying rollback...');
  
  try {
    // If this was the sellable column migration, verify it's been removed
    if (migrationName.includes('sellable')) {
      const [columns] = await connection.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'products' AND column_name = 'sellable'",
        [DB_CONFIG.database]
      );
      
      if (columns.length === 0) {
        console.log('✅ Sellable column removed successfully');
      } else {
        throw new Error('Sellable column still exists after rollback');
      }
    }
    
    // Test basic products table functionality
    const [testQuery] = await connection.execute('SELECT COUNT(*) as count FROM products');
    console.log(`✅ Products table accessible. Total products: ${testQuery[0].count}`);
    
    console.log('✅ Rollback verification completed');
    
  } catch (error) {
    console.error('❌ Rollback verification failed:', error.message);
    throw error;
  }
}

async function restoreFromBackup(backupFile) {
  console.log(`🔄 Restoring from backup: ${backupFile}`);
  
  try {
    // Decompress backup if needed
    let sqlFile = backupFile;
    if (backupFile.endsWith('.gz')) {
      sqlFile = backupFile.replace('.gz', '');
      execSync(`gunzip -c ${backupFile} > ${sqlFile}`, { stdio: 'inherit' });
    }
    
    // Restore from backup
    const command = `mysql -h ${DB_CONFIG.host} -u ${DB_CONFIG.user} -p${DB_CONFIG.password} ${DB_CONFIG.database} < ${sqlFile}`;
    execSync(command, { stdio: 'inherit' });
    
    console.log('✅ Backup restored successfully');
    
    // Clean up temporary file
    if (sqlFile !== backupFile) {
      await fs.unlink(sqlFile);
    }
    
  } catch (error) {
    console.error('❌ Backup restoration failed:', error.message);
    throw error;
  }
}

async function listAppliedMigrations() {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    const [migrations] = await connection.execute(
      'SELECT migration_name, applied_at, status FROM migration_history ORDER BY applied_at DESC'
    );
    
    console.log('📋 Migration History:');
    console.log('');
    
    if (migrations.length === 0) {
      console.log('No migrations found');
      return;
    }
    
    migrations.forEach(migration => {
      const status = migration.status === 'applied' ? '✅' : '🔄';
      console.log(`${status} ${migration.migration_name} (${migration.applied_at}) - ${migration.status}`);
    });
    
  } finally {
    await connection.end();
  }
}

async function main() {
  const command = process.argv[2];
  const migrationName = process.argv[3];
  
  if (command === 'list') {
    await listAppliedMigrations();
    return;
  }
  
  if (!migrationName) {
    console.error('Usage: node rollback-database.js <migration_name>');
    console.error('       node rollback-database.js list');
    console.error('');
    console.error('Example: node rollback-database.js 001_add_sellable_column');
    process.exit(1);
  }
  
  try {
    await rollbackMigration(migrationName);
    
    console.log('');
    console.log('🎉 Rollback completed successfully!');
    console.log('');
    console.log('⚠️  IMPORTANT: Please verify that all applications work correctly');
    console.log('⚠️  Test all critical functionality');
    console.log('');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    console.error('');
    console.error('🆘 Manual intervention may be required');
    console.error('🆘 Check database state and restore from backup if necessary');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  rollbackMigration,
  restoreFromBackup,
  listAppliedMigrations
};