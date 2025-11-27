/**
 * Test for tools GET endpoint - Area dropdown fix
 * 
 * This test directly calls the Lambda handler to observe:
 * 1. Whether organization filter is applied
 * 2. Whether category filter works correctly
 * 3. What SQL is actually generated
 * 4. What data is returned
 * 
 * Run with: node lambda/core/__tests__/tools-area-dropdown.test.js
 */

const handler = require('../index').handler;

// Mock event for testing
function createMockEvent(orgId, accessibleOrgs, category, status) {
  return {
    httpMethod: 'GET',
    path: '/tools',
    queryStringParameters: {
      category: category,
      status: status,
      limit: 100
    },
    requestContext: {
      authorizer: {
        organization_id: orgId,
        accessible_organization_ids: JSON.stringify(accessibleOrgs),
        cognito_user_id: 'test-user-123',
        permissions: JSON.stringify([])
      }
    }
  };
}

// Test function
async function runTests() {
  console.log('🧪 Testing Tools GET endpoint for Area dropdown fix\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Test with organization filter and category filter
  console.log('\n📋 Test 1: Organization + Category filter');
  console.log('-'.repeat(60));
  try {
    const event1 = createMockEvent(
      'org-123',
      ['org-123'],
      'Infrastructure,Container',
      '!removed'
    );
    
    console.log('Event:', JSON.stringify(event1, null, 2));
    console.log('\nCalling handler...\n');
    
    const result1 = await handler(event1);
    
    console.log('Response status:', result1.statusCode);
    console.log('Response body:', result1.body.substring(0, 500));
    
    if (result1.statusCode === 200) {
      const data = JSON.parse(result1.body);
      const tools = data.data || [];
      
      console.log(`\n✅ Returned ${tools.length} tools`);
      
      // Check if any tools have wrong categories
      const wrongCategories = tools.filter(t => 
        t.category !== 'Infrastructure' && t.category !== 'Container'
      );
      
      if (wrongCategories.length > 0) {
        console.log(`\n❌ FAILED: Found ${wrongCategories.length} tools with wrong categories:`);
        wrongCategories.slice(0, 5).forEach(t => {
          console.log(`  - ${t.name} (category: ${t.category})`);
        });
        failed++;
      } else {
        console.log('✅ All tools have correct categories (Infrastructure or Container)');
        passed++;
      }
      
      // Check organization IDs
      const wrongOrgs = tools.filter(t => t.organization_id !== 'org-123');
      if (wrongOrgs.length > 0) {
        console.log(`\n❌ FAILED: Found ${wrongOrgs.length} tools from wrong organization:`);
        wrongOrgs.slice(0, 5).forEach(t => {
          console.log(`  - ${t.name} (org: ${t.organization_id})`);
        });
        failed++;
      } else {
        console.log('✅ All tools belong to correct organization');
        passed++;
      }
      
    } else {
      console.log(`\n❌ FAILED: Expected status 200, got ${result1.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.error('\n❌ Test 1 failed with error:', error.message);
    console.error(error.stack);
    failed++;
  }
  
  // Test 2: Test without category filter (should still filter by org)
  console.log('\n\n📋 Test 2: Organization filter only (no category filter)');
  console.log('-'.repeat(60));
  try {
    const event2 = createMockEvent(
      'org-123',
      ['org-123'],
      null,
      '!removed'
    );
    
    console.log('Event:', JSON.stringify(event2, null, 2));
    console.log('\nCalling handler...\n');
    
    const result2 = await handler(event2);
    
    console.log('Response status:', result2.statusCode);
    
    if (result2.statusCode === 200) {
      const data = JSON.parse(result2.body);
      const tools = data.data || [];
      
      console.log(`✅ Returned ${tools.length} tools`);
      
      // Check organization IDs
      const wrongOrgs = tools.filter(t => t.organization_id !== 'org-123');
      if (wrongOrgs.length > 0) {
        console.log(`\n❌ FAILED: Found ${wrongOrgs.length} tools from wrong organization`);
        failed++;
      } else {
        console.log('✅ All tools belong to correct organization');
        passed++;
      }
    } else {
      console.log(`\n❌ FAILED: Expected status 200, got ${result2.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.error('\n❌ Test 2 failed with error:', error.message);
    console.error(error.stack);
    failed++;
  }
  
  // Test 3: Test with multiple accessible organizations
  console.log('\n\n📋 Test 3: Multiple accessible organizations');
  console.log('-'.repeat(60));
  try {
    const event3 = createMockEvent(
      'org-123',
      ['org-123', 'org-456'],
      'Infrastructure,Container',
      '!removed'
    );
    
    console.log('Event:', JSON.stringify(event3, null, 2));
    console.log('\nCalling handler...\n');
    
    const result3 = await handler(event3);
    
    console.log('Response status:', result3.statusCode);
    
    if (result3.statusCode === 200) {
      const data = JSON.parse(result3.body);
      const tools = data.data || [];
      
      console.log(`✅ Returned ${tools.length} tools`);
      
      // Check organization IDs
      const wrongOrgs = tools.filter(t => 
        t.organization_id !== 'org-123' && t.organization_id !== 'org-456'
      );
      if (wrongOrgs.length > 0) {
        console.log(`\n❌ FAILED: Found ${wrongOrgs.length} tools from wrong organizations`);
        failed++;
      } else {
        console.log('✅ All tools belong to accessible organizations');
        passed++;
      }
    } else {
      console.log(`\n❌ FAILED: Expected status 200, got ${result3.statusCode}`);
      failed++;
    }
  } catch (error) {
    console.error('\n❌ Test 3 failed with error:', error.message);
    console.error(error.stack);
    failed++;
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };

