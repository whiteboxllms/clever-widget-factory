/**
 * Test SQL generation for tools GET endpoint
 * 
 * This test extracts the SQL generation logic and verifies:
 * 1. Organization filter is included in WHERE clause
 * 2. Category filter is correctly formatted
 * 3. Status filter handles "!removed" syntax
 * 4. All filters are combined correctly
 * 
 * Run with: node lambda/core/__tests__/tools-sql-generation.test.js
 */

const assert = require('assert');
const { buildOrganizationFilter } = require('../shared/authorizerContext');

// Mock formatSqlValue function (from index.js)
function formatSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'ARRAY[]::text[]';
    const sanitizedItems = value.map((item) => `'${String(item).replace(/'/g, "''")}'`);
    return `ARRAY[${sanitizedItems.join(', ')}]`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

// Simulate the SQL generation logic from the handler
function generateToolsSQL(authContext, category, status, limit = 50, offset = 0) {
  // Build WHERE clauses for filtering
  const whereClauses = [];
  
  // Add organization filter
  const orgFilter = buildOrganizationFilter(authContext, 'tools');
  if (orgFilter.condition) {
    whereClauses.push(orgFilter.condition);
  }
  
  // Handle category filter (supports comma-separated values like "Infrastructure,Container")
  if (category) {
    const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (categories.length === 1) {
      whereClauses.push(`tools.category = ${formatSqlValue(categories[0])}`);
    } else if (categories.length > 1) {
      const categoryValues = categories.map(c => formatSqlValue(c)).join(', ');
      whereClauses.push(`tools.category IN (${categoryValues})`);
    }
  }
  
  // Handle status filter (supports "!removed" or "!=removed" syntax)
  if (status) {
    if (status === '!removed' || status === '!=removed') {
      whereClauses.push(`tools.status != 'removed'`);
    } else {
      whereClauses.push(`tools.status = ${formatSqlValue(status)}`);
    }
  }
  
  const whereClause = whereClauses.length > 0 
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';
  
  const sql = `SELECT json_agg(row_to_json(result)) FROM (
    SELECT DISTINCT ON (tools.id)
      tools.*,
      CASE 
        WHEN active_checkouts.id IS NOT NULL THEN 'checked_out'
        ELSE tools.status
      END as status,
      CASE WHEN tools.image_url LIKE '%supabase.co%' THEN 
        REPLACE(
          tools.image_url, 
          'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 
          'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/'
        )
      ELSE tools.image_url 
      END as image_url,
      CASE WHEN active_checkouts.id IS NOT NULL THEN true ELSE false END as is_checked_out,
      active_checkouts.user_id as checked_out_user_id,
      active_checkouts.user_name as checked_out_to,
      active_checkouts.checkout_date as checked_out_date,
      active_checkouts.expected_return_date,
      active_checkouts.intended_usage as checkout_intended_usage,
      active_checkouts.notes as checkout_notes
    FROM tools
    ${whereClause}
    LEFT JOIN LATERAL (
      SELECT * FROM checkouts
      WHERE checkouts.tool_id = tools.id
        AND checkouts.is_returned = false
      ORDER BY checkouts.checkout_date DESC NULLS LAST, checkouts.created_at DESC
      LIMIT 1
    ) active_checkouts ON true
    ORDER BY tools.id, tools.name 
    LIMIT ${limit} OFFSET ${offset}
  ) result;`;
  
  return { sql, whereClause, whereClauses };
}

// Test function
function runTests() {
  console.log('🧪 Testing Tools SQL Generation\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Organization filter + Category filter + Status filter
  console.log('\n📋 Test 1: Organization + Category + Status filters');
  console.log('-'.repeat(60));
  try {
    const authContext = {
      organization_id: 'org-123',
      accessible_organization_ids: ['org-123'],
      permissions: []
    };
    
    const { sql, whereClause, whereClauses } = generateToolsSQL(
      authContext,
      'Infrastructure,Container',
      '!removed',
      100
    );
    
    console.log('Generated WHERE clauses:', whereClauses);
    console.log('Generated WHERE clause:', whereClause);
    console.log('\nSQL (first 500 chars):', sql.substring(0, 500));
    
    // Verify organization filter is present
    assert.ok(
      whereClause.includes('tools.organization_id'),
      'Organization filter missing from WHERE clause'
    );
    assert.ok(
      whereClause.includes("'org-123'"),
      'Organization ID not found in WHERE clause'
    );
    
    // Verify category filter is present
    assert.ok(
      whereClause.includes('tools.category IN'),
      'Category filter missing from WHERE clause'
    );
    assert.ok(
      whereClause.includes("'Infrastructure'"),
      'Infrastructure category not found in WHERE clause'
    );
    assert.ok(
      whereClause.includes("'Container'"),
      'Container category not found in WHERE clause'
    );
    
    // Verify status filter is present
    assert.ok(
      whereClause.includes("tools.status != 'removed'"),
      'Status filter missing from WHERE clause'
    );
    
    // Verify WHERE clause comes before LEFT JOIN
    const whereIndex = sql.indexOf(whereClause);
    const joinIndex = sql.indexOf('LEFT JOIN LATERAL');
    assert.ok(whereIndex < joinIndex, 'WHERE clause must come before LEFT JOIN LATERAL');
    
    console.log('\n✅ Test 1 passed: All filters are correctly included');
    passed++;
  } catch (error) {
    console.error('\n❌ Test 1 failed:', error.message);
    failed++;
  }
  
  // Test 2: Multiple organizations
  console.log('\n\n📋 Test 2: Multiple accessible organizations');
  console.log('-'.repeat(60));
  try {
    const authContext = {
      organization_id: 'org-123',
      accessible_organization_ids: ['org-123', 'org-456', 'org-789'],
      permissions: []
    };
    
    const { whereClause } = generateToolsSQL(
      authContext,
      'Infrastructure,Container',
      '!removed'
    );
    
    console.log('Generated WHERE clause:', whereClause);
    
    // Verify IN clause for multiple orgs
    assert.ok(
      whereClause.includes('tools.organization_id IN'),
      'Multiple orgs should use IN clause'
    );
    assert.ok(
      whereClause.includes("'org-123'"),
      'First org ID not found'
    );
    assert.ok(
      whereClause.includes("'org-456'"),
      'Second org ID not found'
    );
    assert.ok(
      whereClause.includes("'org-789'"),
      'Third org ID not found'
    );
    
    console.log('\n✅ Test 2 passed: Multiple organizations use IN clause');
    passed++;
  } catch (error) {
    console.error('\n❌ Test 2 failed:', error.message);
    failed++;
  }
  
  // Test 3: data:read:all permission (should not filter by org)
  console.log('\n\n📋 Test 3: data:read:all permission (no org filter)');
  console.log('-'.repeat(60));
  try {
    const authContext = {
      organization_id: 'org-123',
      accessible_organization_ids: ['org-123'],
      permissions: ['data:read:all']
    };
    
    const { whereClause, whereClauses } = generateToolsSQL(
      authContext,
      'Infrastructure,Container',
      '!removed'
    );
    
    console.log('Generated WHERE clauses:', whereClauses);
    console.log('Generated WHERE clause:', whereClause);
    
    // Verify organization filter is NOT present (empty condition)
    const orgFilter = buildOrganizationFilter(authContext, 'tools');
    assert.strictEqual(
      orgFilter.condition,
      '',
      'data:read:all should return empty org filter condition'
    );
    
    // But category and status filters should still be present
    assert.ok(
      whereClause.includes('tools.category IN'),
      'Category filter should still be present'
    );
    assert.ok(
      whereClause.includes("tools.status != 'removed'"),
      'Status filter should still be present'
    );
    
    console.log('\n✅ Test 3 passed: data:read:all skips org filter but keeps other filters');
    passed++;
  } catch (error) {
    console.error('\n❌ Test 3 failed:', error.message);
    failed++;
  }
  
  // Test 4: No category filter (only org and status)
  console.log('\n\n📋 Test 4: Organization + Status filters (no category)');
  console.log('-'.repeat(60));
  try {
    const authContext = {
      organization_id: 'org-123',
      accessible_organization_ids: ['org-123'],
      permissions: []
    };
    
    const { whereClause } = generateToolsSQL(
      authContext,
      null,
      '!removed'
    );
    
    console.log('Generated WHERE clause:', whereClause);
    
    // Verify organization filter is present
    assert.ok(
      whereClause.includes('tools.organization_id'),
      'Organization filter should be present'
    );
    
    // Verify status filter is present
    assert.ok(
      whereClause.includes("tools.status != 'removed'"),
      'Status filter should be present'
    );
    
    // Verify category filter is NOT present
    assert.ok(
      !whereClause.includes('tools.category'),
      'Category filter should NOT be present'
    );
    
    console.log('\n✅ Test 4 passed: Only org and status filters when category is null');
    passed++;
  } catch (error) {
    console.error('\n❌ Test 4 failed:', error.message);
    failed++;
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! SQL generation is correct.');
    process.exit(0);
  }
}

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = { generateToolsSQL, runTests };

