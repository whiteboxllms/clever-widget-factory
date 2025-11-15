import { Client } from 'pg';

// Create PostgreSQL client for direct RDS connection
export const createRDSClient = () => {
  return new Client({
    host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
    user: 'postgres',
    password: 'CWF_Dev_2025!',
    database: 'postgres',
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

// Helper function to execute queries
export const executeQuery = async (query: string, params: any[] = []) => {
  const client = createRDSClient();
  
  try {
    await client.connect();
    const result = await client.query(query, params);
    return { data: result.rows, error: null };
  } catch (error) {
    console.error('RDS Query error:', error);
    return { data: null, error };
  } finally {
    await client.end();
  }
};
