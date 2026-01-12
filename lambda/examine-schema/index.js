const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const client = new Client(dbConfig);
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

exports.handler = async (event) => {
  console.log('Examining database schema for exploration data collection flow...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
  
  try {
    // Get actions table structure
    const actionsTableSql = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'actions' 
      ORDER BY ordinal_position;
    `;
    
    // Check if exploration-related tables exist
    const tableExistsSql = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('exploration', 'policy', 'action_embedding', 'exploration_embedding', 'policy_embedding')
      ORDER BY table_name;
    `;
    
    // Get sample actions data to understand current structure
    const sampleActionsSql = `
      SELECT * FROM actions 
      LIMIT 3;
    `;
    
    const [actionsColumns, existingTables, sampleActions] = await Promise.all([
      queryJSON(actionsTableSql),
      queryJSON(tableExistsSql),
      queryJSON(sampleActionsSql)
    ]);
    
    const result = {
      actions_table_columns: actionsColumns,
      existing_exploration_tables: existingTables,
      sample_actions: sampleActions,
      analysis: {
        has_summary_policy_text: actionsColumns.some(col => col.column_name === 'summary_policy_text'),
        has_policy_id: actionsColumns.some(col => col.column_name === 'policy_id'),
        has_state_text: actionsColumns.some(col => col.column_name === 'state_text'),
        has_policy_text: actionsColumns.some(col => col.column_name === 'policy_text'),
        exploration_tables_exist: existingTables.length > 0
      }
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result, null, 2)
    };
    
  } catch (error) {
    console.error('Schema examination error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to examine schema',
        message: error.message 
      })
    };
  }
};