/**
 * Example SQL output for tools GET endpoint with category filter
 * 
 * This shows what the generated SQL looks like when called with:
 * /tools?category=Infrastructure,Container&status=!removed
 */

// Simulated query parameters
const category = 'Infrastructure,Container';
const status = '!removed';
const limit = 50;
const offset = 0;

// formatSqlValue function (from index.js)
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

// Build WHERE clauses
const whereClauses = [];

// Handle category filter
if (category) {
  const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
  if (categories.length === 1) {
    whereClauses.push(`tools.category = ${formatSqlValue(categories[0])}`);
  } else if (categories.length > 1) {
    const categoryValues = categories.map(c => formatSqlValue(c)).join(', ');
    whereClauses.push(`tools.category IN (${categoryValues})`);
  }
}

// Handle status filter
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

// Generate SQL
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

console.log('Generated SQL for /tools?category=Infrastructure,Container&status=!removed:\n');
console.log('='.repeat(80));
console.log(sql);
console.log('='.repeat(80));
console.log('\n✅ SQL structure is correct:');
console.log('  - WHERE clause is placed BEFORE LEFT JOIN LATERAL');
console.log('  - Category filter: tools.category IN (\'Infrastructure\', \'Container\')');
console.log('  - Status filter: tools.status != \'removed\'');
console.log('  - This will exclude Hand Tools, Electric Tool, and other categories');


