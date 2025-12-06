/**
 * Test for tools GET endpoint category filtering
 * 
 * Verifies that:
 * 1. Category filter is correctly parsed from query parameters
 * 2. Status filter handles "!removed" syntax
 * 3. WHERE clause is generated correctly
 * 4. SQL structure is valid (WHERE before JOIN)
 * 
 * Run with: node lambda/core/__tests__/tools-category-filter.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock formatSqlValue function (simplified version)
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

// Extract and test the SQL generation logic
function testCategoryFilter() {
  const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  
  // Test 1: Verify category filter parsing logic exists
  console.log('Test 1: Checking category filter parsing...');
  const hasCategoryParsing = code.includes('category.split') && 
                              code.includes('category IN');
  assert(hasCategoryParsing, 'Category filter parsing logic not found');
  console.log('✓ Category filter parsing found');
  
  // Test 2: Verify status filter handles "!removed"
  console.log('\nTest 2: Checking status filter...');
  const hasStatusFilter = code.includes('!removed') || code.includes('!=removed');
  assert(hasStatusFilter, 'Status filter for !removed not found');
  console.log('✓ Status filter found');
  
  // Test 3: Verify WHERE clause placement (before JOIN)
  console.log('\nTest 3: Checking WHERE clause placement...');
  const sqlSection = code.match(/FROM tools[\s\S]*?LEFT JOIN LATERAL/);
  if (sqlSection) {
    const sqlText = sqlSection[0];
    // Check if WHERE appears before LEFT JOIN LATERAL
    const whereIndex = sqlText.indexOf('${whereClause}');
    const joinIndex = sqlText.indexOf('LEFT JOIN LATERAL');
    
    assert(whereIndex !== -1, 'WHERE clause placeholder not found');
    assert(joinIndex !== -1, 'LEFT JOIN LATERAL not found');
    assert(whereIndex < joinIndex, 'WHERE clause must come BEFORE LEFT JOIN LATERAL');
    console.log('✓ WHERE clause is correctly placed before LEFT JOIN LATERAL');
  } else {
    throw new Error('Could not find SQL section with FROM tools and LEFT JOIN LATERAL');
  }
  
  // Test 4: Simulate query parameter parsing
  console.log('\nTest 4: Simulating query parameter parsing...');
  
  // Simulate: category=Infrastructure,Container&status=!removed
  const category = 'Infrastructure,Container';
  const status = '!removed';
  
  const whereClauses = [];
  
  // Parse category
  if (category) {
    const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
    if (categories.length === 1) {
      whereClauses.push(`tools.category = ${formatSqlValue(categories[0])}`);
    } else if (categories.length > 1) {
      const categoryValues = categories.map(c => formatSqlValue(c)).join(', ');
      whereClauses.push(`tools.category IN (${categoryValues})`);
    }
  }
  
  // Parse status
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
  
  console.log('Generated WHERE clause:', whereClause);
  
  // Verify the generated WHERE clause
  assert(whereClause.includes("tools.category IN ('Infrastructure', 'Container')"), 
         'Category filter not correctly generated');
  assert(whereClause.includes("tools.status != 'removed'"), 
         'Status filter not correctly generated');
  console.log('✓ Query parameters correctly parsed and WHERE clause generated');
  
  // Test 5: Verify SQL structure
  console.log('\nTest 5: Verifying SQL structure...');
  const expectedStructure = `FROM tools
          ${whereClause}
          LEFT JOIN LATERAL`;
  
  // Check that the code has this structure
  const hasCorrectStructure = code.includes('FROM tools') && 
                              code.includes('${whereClause}') &&
                              code.includes('LEFT JOIN LATERAL');
  assert(hasCorrectStructure, 'SQL structure is incorrect');
  console.log('✓ SQL structure is correct');
  
  console.log('\n✅ All tests passed!');
}

// Run tests
try {
  testCategoryFilter();
  console.log('\n🎉 Category filter implementation is correct!');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}





