#!/usr/bin/env node

/**
 * Database Backup Script
 * Creates logical backups of database tables before migrations
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Configuration (should be moved to environment variables)
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farm_db'
};

const BACKUP_DIR = path.join(__dirname, '../database/backups');

async function ensureBackupDirectory() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

async function createLogicalBackup(tableName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}_${tableName}.sql`);
  
  console.log(`Creating backup for table: ${tableName}`);
  
  try {
    // Use mysqldump for logical backup
    const command = `mysqldump -h ${DB_CONFIG.host} -u ${DB_CONFIG.user} -p${DB_CONFIG.password} ${DB_CONFIG.database} ${tableName} > ${backupFile}`;
    
    execSync(command, { stdio: 'inherit' });
    
    // Compress the backup
    execSync(`gzip ${backupFile}`, { stdio: 'inherit' });
    
    console.log(`✅ Backup created: ${backupFile}.gz`);
    return `${backupFile}.gz`;
  } catch (error) {
    console.error(`❌ Failed to backup table ${tableName}:`, error.message);
    throw error;
  }
}

async function verifyTableExists(tableName) {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
      [DB_CONFIG.database, tableName]
    );
    
    return rows[0].count > 0;
  } finally {
    await connection.end();
  }
}

async function getTableStructure(tableName) {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    const [rows] = await connection.execute(`SHOW CREATE TABLE ${tableName}`);
    return rows[0]['Create Table'];
  } finally {
    await connection.end();
  }
}

async function main() {
  const tableName = process.argv[2];
  
  if (!tableName) {
    console.error('Usage: node backup-database.js <table_name>');
    console.error('Example: node backup-database.js products');
    process.exit(1);
  }
  
  try {
    await ensureBackupDirectory();
    
    // Verify table exists
    const exists = await verifyTableExists(tableName);
    if (!exists) {
      console.error(`❌ Table '${tableName}' does not exist in database '${DB_CONFIG.database}'`);
      process.exit(1);
    }
    
    // Get table structure for documentation
    const structure = await getTableStructure(tableName);
    console.log(`📋 Table structure for ${tableName}:`);
    console.log(structure);
    console.log('');
    
    // Create backup
    const backupPath = await createLogicalBackup(tableName);
    
    // Log backup info
    const logEntry = {
      timestamp: new Date().toISOString(),
      table: tableName,
      backupFile: backupPath,
      structure: structure
    };
    
    const logFile = path.join(BACKUP_DIR, 'backup_log.json');
    let logs = [];
    
    try {
      const existingLogs = await fs.readFile(logFile, 'utf8');
      logs = JSON.parse(existingLogs);
    } catch {
      // File doesn't exist yet
    }
    
    logs.push(logEntry);
    await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    
    console.log(`📝 Backup logged to: ${logFile}`);
    console.log('✅ Backup process completed successfully');
    
  } catch (error) {
    console.error('❌ Backup process failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createLogicalBackup,
  verifyTableExists,
  getTableStructure
};