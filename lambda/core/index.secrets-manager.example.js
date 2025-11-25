/**
 * Example: Using AWS Secrets Manager for Database Credentials
 * 
 * This is an example showing how to use Secrets Manager instead of
 * environment variables. To use this:
 * 
 * 1. Install dependency: npm install @aws-sdk/client-secrets-manager
 * 2. Create secret in AWS Secrets Manager (see SECRETS_SETUP.md)
 * 3. Grant Lambda execution role permissions
 * 4. Replace the dbConfig initialization below
 */

const { Client } = require('pg');
const { randomUUID } = require('crypto');
const { getAuthorizerContext, buildOrganizationFilter, hasPermission, canAccessOrganization } = require('./shared/authorizerContext');
const { getDatabaseCredentials } = require('./shared/getSecret');

// Database configuration with Secrets Manager
// Falls back to environment variables if secret not available
let dbConfig;
let dbConfigPromise;

async function initializeDbConfig() {
  // Try Secrets Manager first, fall back to environment variables
  if (process.env.USE_SECRETS_MANAGER === 'true') {
    try {
      const secretName = process.env.DB_SECRET_NAME || 'cwf/rds/postgres';
      dbConfig = await getDatabaseCredentials(secretName);
      console.log('Database credentials loaded from Secrets Manager');
    } catch (error) {
      console.error('Failed to load from Secrets Manager, falling back to env vars:', error);
      // Fall through to environment variable approach
    }
  }
  
  // Fallback to environment variables
  if (!dbConfig) {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required (or set USE_SECRETS_MANAGER=true)');
    }
    
    dbConfig = {
      host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false
      }
    };
  } else {
    // Add SSL config if not in secret
    dbConfig.ssl = dbConfig.ssl || {
      rejectUnauthorized: false
    };
  }
  
  return dbConfig;
}

// Initialize on first Lambda invocation (container reuse means this persists)
async function getDbConfig() {
  if (!dbConfigPromise) {
    dbConfigPromise = initializeDbConfig();
  }
  if (!dbConfig) {
    dbConfig = await dbConfigPromise;
  }
  return dbConfig;
}

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const config = await getDbConfig();
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Rest of the handler code remains the same...
// (The queryJSON function is the only change needed)


