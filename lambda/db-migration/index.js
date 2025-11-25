const { Client } = require('pg');

// SECURITY: Password must be provided via environment variable
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
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