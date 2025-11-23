/**
 * Lambda function to migrate old user IDs to Cognito user IDs
 * 
 * This function:
 * 1. Finds all old user IDs in parts_history and other tables
 * 2. Maps them to Cognito user IDs via organization_members table
 * 3. Updates the records
 * 
 * Usage: Invoke via AWS Lambda console or CLI with event: { "dryRun": true }
 */

const { Client } = require('pg');

// Database configuration
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

// Known user ID mappings from old Supabase IDs to Cognito IDs
const USER_ID_MAPPINGS = {
  '68a18380-7011-70b9-85e7-435f2964154d': null, // Need to find the Cognito ID for this user
  'b8006f2b-0ec7-4107-b05a-b4c6b49541fd': '08617390-b001-708d-f61e-07a1698282ec', // Stefan Hamilton
  '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8': '989163e0-7011-70ee-6d93-853674acd43c', // Malone
  '7dd4187f-ff2a-4367-9e7b-0c8741f25495': '68d173b0-60f1-70ea-6084-338e74051fcc', // Lester Paniel
  '48155769-4d22-4d36-9982-095ac9ad6b2c': '1891f310-c071-705a-2c72-0d0a33c92bf0', // Mae Dela Torre
};

async function findUserMapping(client, oldUserId) {
  // First check if we have a hardcoded mapping
  if (USER_ID_MAPPINGS[oldUserId]) {
    return USER_ID_MAPPINGS[oldUserId];
  }

  // Try to find the user in organization_members by matching old user_id or cognito_user_id
  // Since changed_by is TEXT, we need to cast it
  const result = await client.query(`
    SELECT cognito_user_id, email, full_name, user_id, id
    FROM organization_members
    WHERE user_id::text = $1
       OR id::text = $1
       OR cognito_user_id::text = $1
    LIMIT 1
  `, [oldUserId]);

  if (result.rows.length > 0) {
    // If we found a record, return the cognito_user_id if it exists
    // Otherwise, return the user_id or id (which might already be a Cognito ID)
    const row = result.rows[0];
    return row.cognito_user_id || row.user_id || row.id;
  }

  return null;
}

async function migrateTable(client, tableName, userIdColumn, dryRun) {
  console.log(`\n📊 Analyzing ${tableName}.${userIdColumn}...`);

  // Find all unique old user IDs
  // Note: changed_by is TEXT, not UUID, so we need to handle it as text
  const oldUserIds = await client.query(`
    SELECT DISTINCT ${userIdColumn} as user_id, COUNT(*) as count
    FROM ${tableName}
    WHERE ${userIdColumn} IS NOT NULL
      AND ${userIdColumn}::text != '00000000-0000-0000-0000-000000000000'
      AND ${userIdColumn}::text != 'system'
      AND ${userIdColumn}::text NOT LIKE '08617390-%'  -- Skip already migrated Cognito IDs
      AND ${userIdColumn}::text NOT LIKE '1891f310-%'
      AND ${userIdColumn}::text NOT LIKE '989163e0-%'
      AND ${userIdColumn}::text NOT LIKE '68d173b0-%'
    GROUP BY ${userIdColumn}
    ORDER BY count DESC
  `);

  console.log(`Found ${oldUserIds.rows.length} unique old user IDs in ${tableName}`);

  const mappings = {};
  const unmapped = [];

  // Find mappings for each old user ID
  for (const row of oldUserIds.rows) {
    const oldUserId = row.user_id;
    const newUserId = await findUserMapping(client, oldUserId);

    if (newUserId) {
      mappings[oldUserId] = newUserId;
      console.log(`  ✅ ${oldUserId} -> ${newUserId} (${row.count} records)`);
    } else {
      unmapped.push({ id: oldUserId, count: row.count });
      console.log(`  ⚠️  ${oldUserId} - NO MAPPING FOUND (${row.count} records)`);
    }
  }

  if (unmapped.length > 0) {
    console.log(`\n⚠️  Warning: ${unmapped.length} user IDs could not be mapped:`);
    unmapped.forEach(u => console.log(`    - ${u.id} (${u.count} records)`));
  }

  // Update records
  let totalUpdated = 0;
  if (Object.keys(mappings).length > 0) {
    for (const [oldUserId, newUserId] of Object.entries(mappings)) {
      if (dryRun) {
        const countResult = await client.query(`
          SELECT COUNT(*) as count
          FROM ${tableName}
          WHERE ${userIdColumn} = $1
        `, [oldUserId]);
        console.log(`  [DRY RUN] Would update ${countResult.rows[0].count} records: ${oldUserId} -> ${newUserId}`);
        totalUpdated += parseInt(countResult.rows[0].count);
      } else {
        const result = await client.query(`
          UPDATE ${tableName}
          SET ${userIdColumn} = $2
          WHERE ${userIdColumn} = $1
        `, [oldUserId, newUserId]);
        console.log(`  ✅ Updated ${result.rowCount} records: ${oldUserId} -> ${newUserId}`);
        totalUpdated += result.rowCount;
      }
    }
  }

  console.log(`\n✅ Total records ${dryRun ? 'to be ' : ''}updated in ${tableName}: ${totalUpdated}`);
  return { mapped: Object.keys(mappings).length, unmapped: unmapped.length, updated: totalUpdated };
}

exports.handler = async (event) => {
  const client = new Client(dbConfig);
  const dryRun = event.dryRun !== false; // Default to dry run for safety

  try {
    await client.connect();
    console.log('✅ Connected to database');

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    } else {
      console.log('\n⚠️  LIVE MODE - Changes will be made to the database\n');
    }

    const results = {
      parts_history: await migrateTable(client, 'parts_history', 'changed_by', dryRun),
    };

    console.log('\n✅ Migration complete!');
    console.log('\n📊 Summary:');
    console.log(JSON.stringify(results, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        dryRun,
        results
      })
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  } finally {
    await client.end();
  }
};

