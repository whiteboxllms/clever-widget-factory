/**
 * Lambda function to search for a user ID across all possible tables
 * This helps find where old Supabase user IDs might be stored
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

    // Check organization_members by user_id (old Supabase format)
    const orgMembersByUserId = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE user_id::text = $1
    `, [searchUserId]);

    // Check organization_members by id
    const orgMembersById = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE id::text = $1
    `, [searchUserId]);

    // Check if there's a profiles table (Supabase auth.users equivalent)
    let profilesResult = { rows: [] };
    try {
      profilesResult = await client.query(`
        SELECT id, user_id, email, full_name
        FROM profiles
        WHERE id::text = $1 OR user_id::text = $1
        LIMIT 1
      `, [searchUserId]);
    } catch (e) {
      console.log('Profiles table not found or error:', e.message);
    }

    // Check parts_history to see the pattern of this user's activity
    const partsHistorySample = await client.query(`
      SELECT 
        changed_by,
        change_type,
        change_reason,
        changed_at,
        part_id
      FROM parts_history
      WHERE changed_by = $1
      ORDER BY changed_at DESC
      LIMIT 5
    `, [searchUserId]);

    // Check if this might be a Cognito ID that's already in use
    const checkAsCognitoId = await client.query(`
      SELECT id, user_id, cognito_user_id, email, full_name, role
      FROM organization_members
      WHERE cognito_user_id::text = $1
    `, [searchUserId]);

    // Get all unique user_ids from organization_members to see the pattern
    const allUserIds = await client.query(`
      SELECT DISTINCT user_id, COUNT(*) as member_count
      FROM organization_members
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY member_count DESC
      LIMIT 30
    `);

    const result = {
      searchUserId,
      foundInOrgMembersByUserId: orgMembersByUserId.rows,
      foundInOrgMembersById: orgMembersById.rows,
      foundInProfiles: profilesResult.rows,
      foundAsCognitoId: checkAsCognitoId.rows,
      partsHistorySample: partsHistorySample.rows,
      allUserIdsPattern: allUserIds.rows.map(r => ({
        user_id: r.user_id,
        member_count: r.member_count
      }))
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message, 
        stack: error.stack,
        searchUserId 
      })
    };
  } finally {
    await client.end();
  }
};

