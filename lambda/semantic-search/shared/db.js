const { Client } = require('pg');

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

async function query(sql) {
  const client = new Client(dbConfig);
  await client.connect();
  try {
    const result = await client.query(sql);
    console.log('Query executed, rows returned:', result.rows.length);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

module.exports = { query };
