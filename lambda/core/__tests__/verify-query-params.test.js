/**
 * Quick test to verify query parameter parsing
 * This helps debug why filters aren't being applied
 */

// Simulate the query parameter parsing from the handler
function parseQueryParams(queryStringParameters) {
  const { limit = 50, offset = 0, category, status } = queryStringParameters || {};
  
  console.log('📋 Query Parameters:');
  console.log('  category:', category, typeof category);
  console.log('  status:', status, typeof status);
  console.log('  limit:', limit);
  console.log('  offset:', offset);
  
  // Build WHERE clauses for filtering
  const whereClauses = [];
  
  // Handle category filter
  if (category) {
    console.log('\n✅ Category filter is present');
    const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
    console.log('  Parsed categories:', categories);
    if (categories.length === 1) {
      whereClauses.push(`tools.category = '${categories[0]}'`);
    } else if (categories.length > 1) {
      const categoryValues = categories.map(c => `'${c}'`).join(', ');
      whereClauses.push(`tools.category IN (${categoryValues})`);
    }
  } else {
    console.log('\n❌ Category filter is MISSING');
  }
  
  // Handle status filter
  if (status) {
    console.log('\n✅ Status filter is present');
    if (status === '!removed' || status === '!=removed') {
      whereClauses.push(`tools.status != 'removed'`);
      console.log('  Using: tools.status != \'removed\'');
    } else {
      whereClauses.push(`tools.status = '${status}'`);
      console.log('  Using: tools.status = \'' + status + '\'');
    }
  } else {
    console.log('\n❌ Status filter is MISSING');
  }
  
  const whereClause = whereClauses.length > 0 
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';
  
  console.log('\n📊 Generated WHERE clause:');
  console.log('  ' + whereClause || '(empty)');
  
  return { category, status, whereClause, whereClauses };
}

// Test cases
console.log('='.repeat(60));
console.log('Test 1: Expected query parameters');
console.log('='.repeat(60));
const result1 = parseQueryParams({
  category: 'Infrastructure,Container',
  status: '!removed',
  limit: 100
});

console.log('\n' + '='.repeat(60));
console.log('Test 2: Missing category parameter');
console.log('='.repeat(60));
const result2 = parseQueryParams({
  status: '!removed',
  limit: 100
});

console.log('\n' + '='.repeat(60));
console.log('Test 3: URL-encoded parameters (how they might come from frontend)');
console.log('='.repeat(60));
// Simulate URL decoding
const url = '/tools?category=Infrastructure,Container&status=!removed';
const urlParams = new URLSearchParams(url.split('?')[1]);
const params = {};
for (const [key, value] of urlParams.entries()) {
  params[key] = value;
}
const result3 = parseQueryParams(params);

console.log('\n' + '='.repeat(60));
console.log('✅ Test complete');
console.log('='.repeat(60));

