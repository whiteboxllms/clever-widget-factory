const { Client } = require('pg');

const dbConfig = {
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || 'CWF_Dev_2025!',
  ssl: {
    rejectUnauthorized: false
  }
};

exports.handler = async (event) => {
  const { sql } = event;
  
  if (!sql) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'SQL parameter required' })
    };
  }

  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    const result = await client.query(sql);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        rowCount: result.rowCount,
        command: result.command
      })
    };
  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        detail: error.detail
      })
    };
  } finally {
    await client.end();
  }
};