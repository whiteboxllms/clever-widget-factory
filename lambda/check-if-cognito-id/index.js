/**
 * Check if the user ID is actually a Cognito ID that should be used as-is
 * or if we need to find its mapping
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
  const userId = event.userId || '68a18380-7011-70b9-85e7-435f2964154d';

  try {
    await client.connect();

    // Check if this ID exists as a cognito_user_id in organization_members
    const asCognitoId = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE cognito_user_id::text = $1
    `, [userId]);

    // Check if this ID exists as user_id (maybe it's already the right format)
    const asUserId = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE user_id::text = $1
    `, [userId]);

    // Check if this ID exists as id
    const asId = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE id::text = $1
    `, [userId]);

    // Get all organization_members to see the full picture
    const allMembers = await client.query(`
      SELECT 
        id,
        user_id,
        cognito_user_id,
        email,
        full_name,
        role,
        created_at
      FROM organization_members
      ORDER BY created_at
    `);

    // Check parts_history to see if there are other user IDs that might give us clues
    const otherUserIds = await client.query(`
      SELECT DISTINCT changed_by, COUNT(*) as count
      FROM parts_history
      WHERE changed_by IS NOT NULL
        AND changed_by != '00000000-0000-0000-0000-000000000000'
        AND changed_by != 'system'
      GROUP BY changed_by
      ORDER BY count DESC
      LIMIT 20
    `);

    const result = {
      userId,
      foundAsCognitoId: asCognitoId.rows,
      foundAsUserId: asUserId.rows,
      foundAsId: asId.rows,
      allOrganizationMembers: allMembers.rows.map(m => ({
        id: m.id,
        user_id: m.user_id,
        cognito_user_id: m.cognito_user_id,
        email: m.email,
        full_name: m.full_name,
        role: m.role
      })),
      otherUserIdsInPartsHistory: otherUserIds.rows
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


