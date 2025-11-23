/**
 * Lambda function to query information about old user ID
 * This helps identify which user the old ID belongs to
 */

const { Client } = require('pg');

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

exports.handler = async (event) => {
  const client = new Client(dbConfig);
  const oldUserId = event.userId || '68a18380-7011-70b9-85e7-435f2964154d';

  try {
    await client.connect();

    // Query parts_history to see activity patterns
    const historyResult = await client.query(`
      SELECT 
        COUNT(*) as record_count,
        MIN(changed_at) as earliest_record,
        MAX(changed_at) as latest_record,
        array_agg(DISTINCT part_id) FILTER (WHERE part_id IS NOT NULL) as affected_parts,
        array_agg(DISTINCT change_type) as change_types
      FROM parts_history
      WHERE changed_by = $1
    `, [oldUserId]);

    // Check if this ID exists in organization_members in any form
    const memberResult = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role
      FROM organization_members
      WHERE user_id::text = $1
         OR id::text = $1
         OR cognito_user_id::text = $1
    `, [oldUserId]);

    // Check if there are similar user IDs (maybe a typo or variant)
    const similarResult = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name
      FROM organization_members
      WHERE user_id::text LIKE $1
         OR cognito_user_id::text LIKE $1
      LIMIT 10
    `, [`${oldUserId.substring(0, 8)}%`]);

    const result = {
      oldUserId,
      history: historyResult.rows[0],
      organizationMember: memberResult.rows[0] || null,
      similarUsers: similarResult.rows
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    await client.end();
  }
};

