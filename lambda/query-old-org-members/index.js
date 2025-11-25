/**
 * Lambda function to query old organization_members data
 * This helps find user ID mappings from the Supabase era
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
  const searchUserId = event.userId || '68a18380-7011-70b9-85e7-435f2964154d';

  try {
    await client.connect();

    // Query all organization_members to see if any have this as user_id or id
    const allMembers = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role,
        organization_id,
        created_at
      FROM organization_members
      ORDER BY created_at DESC
    `);

    // Search for the specific user ID
    const specificUser = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role,
        organization_id
      FROM organization_members
      WHERE user_id::text = $1
         OR id::text = $1
         OR cognito_user_id::text = $1
    `, [searchUserId]);

    // Check if there are any old user_ids that match the pattern
    // Old Supabase IDs might be stored in user_id field
    const oldFormatUsers = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role
      FROM organization_members
      WHERE user_id::text LIKE '68a18380%'
         OR id::text LIKE '68a18380%'
         OR cognito_user_id::text LIKE '68a18380%'
    `);

    // Also check if this user_id appears in any other context
    // Maybe it's stored as a string in a different format
    const anyMatch = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role
      FROM organization_members
      WHERE user_id::text LIKE '%68a18380%'
         OR id::text LIKE '%68a18380%'
         OR cognito_user_id::text LIKE '%68a18380%'
         OR email LIKE '%68a18380%'
    `);

    const result = {
      searchUserId,
      specificUser: specificUser.rows[0] || null,
      oldFormatUsers: oldFormatUsers.rows,
      anyMatch: anyMatch.rows,
      allMembersCount: allMembers.rows.length,
      sampleMembers: allMembers.rows.slice(0, 20).map(m => ({
        id: m.id,
        user_id: m.user_id,
        cognito_user_id: m.cognito_user_id,
        email: m.email,
        full_name: m.full_name,
        role: m.role
      }))
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  } finally {
    await client.end();
  }
};


