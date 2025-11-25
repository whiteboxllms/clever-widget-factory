/**
 * Tests for missions endpoint organization filtering
 * Verifies that missions are filtered correctly based on accessible_organization_ids
 */

const assert = require('assert');
const { buildOrganizationFilter, getAuthorizerContext } = require('../../shared/authorizerContext');

// Simple test runner
function runTests() {
  console.log('Running missions endpoint organization filtering tests...\n');
  let passed = 0;
  let failed = 0;

  // Test 1: data:read:all permission should return empty condition
  try {
    const context1 = {
      accessible_organization_ids: ['org-1'],
      permissions: ['data:read:all']
    };
    const filter1 = buildOrganizationFilter(context1, 'm');
    assert.strictEqual(filter1.condition, '');
    console.log('✓ Test 1: data:read:all permission returns empty condition');
    passed++;
  } catch (error) {
    console.log('✗ Test 1:', error.message);
    failed++;
  }

  // Test 2: Single organization should filter correctly
  try {
    const context2 = {
      accessible_organization_ids: ['org-1'],
      permissions: []
    };
    const filter2 = buildOrganizationFilter(context2, 'm');
    assert.strictEqual(filter2.condition, "m.organization_id = 'org-1'");
    console.log('✓ Test 2: Single organization filters correctly');
    passed++;
  } catch (error) {
    console.log('✗ Test 2:', error.message);
    failed++;
  }

  // Test 3: Multiple organizations should use IN clause
  try {
    const context3 = {
      accessible_organization_ids: ['org-1', 'org-2', 'org-3'],
      permissions: []
    };
    const filter3 = buildOrganizationFilter(context3, 'm');
    assert.ok(filter3.condition.includes('m.organization_id IN'));
    assert.ok(filter3.condition.includes("'org-1'"));
    assert.ok(filter3.condition.includes("'org-2'"));
    assert.ok(filter3.condition.includes("'org-3'"));
    console.log('✓ Test 3: Multiple organizations use IN clause');
    passed++;
  } catch (error) {
    console.log('✗ Test 3:', error.message);
    failed++;
  }

  // Test 4: Empty accessible_organization_ids should deny access
  try {
    const context4 = {
      accessible_organization_ids: [],
      permissions: []
    };
    const filter4 = buildOrganizationFilter(context4, 'm');
    assert.strictEqual(filter4.condition, '1=0');
    console.log('✓ Test 4: Empty accessible_organization_ids denies access');
    passed++;
  } catch (error) {
    console.log('✗ Test 4:', error.message);
    failed++;
  }

  // Test 5: Parse accessible_organization_ids from JSON string
  try {
    const event = {
      requestContext: {
        authorizer: {
          organization_id: 'org-1',
          accessible_organization_ids: '["org-1","org-2","org-3"]'
        }
      }
    };
    const context = getAuthorizerContext(event);
    assert.strictEqual(context.organization_id, 'org-1');
    assert.deepStrictEqual(context.accessible_organization_ids, ['org-1', 'org-2', 'org-3']);
    console.log('✓ Test 5: Parse accessible_organization_ids from JSON string');
    passed++;
  } catch (error) {
    console.log('✗ Test 5:', error.message);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
