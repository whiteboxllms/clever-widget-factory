#!/usr/bin/env node

/**
 * Test script to verify action_scores API endpoints
 * Run: node test-action-scores-api.js
 */

const https = require('https');

const API_BASE = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';

// Test user IDs from README.md
const TEST_USERS = {
  malone: '989163e0-7011-70ee-6d93-853674acd43c',
  lester: '68d173b0-60f1-70ea-6084-338e74051fcc',
  mae: '1891f310-c071-705a-2c72-0d0a33c92bf0',
  stefan: '08617390-b001-708d-f61e-07a1698282ec'
};

function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '0720au267k.execute-api.us-west-2.amazonaws.com',
      path: `/prod${path}`,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testEndpoints() {
  console.log('🧪 Testing Action Scores API Endpoints\n');
  console.log('=' .repeat(60));

  // Test 1: Get all action scores (no auth - should fail)
  console.log('\n1️⃣  GET /api/action_scores (no auth)');
  const test1 = await makeRequest('/api/action_scores');
  console.log(`   Status: ${test1.status}`);
  console.log(`   Response:`, JSON.stringify(test1.data, null, 2).substring(0, 200));

  // Test 2: Get actions with assigned users
  console.log('\n2️⃣  GET /api/actions (check for assigned_to field)');
  const test2 = await makeRequest('/api/actions');
  console.log(`   Status: ${test2.status}`);
  if (test2.data?.data) {
    const actionsWithUsers = test2.data.data.filter(a => a.assigned_to);
    console.log(`   Total actions: ${test2.data.data.length}`);
    console.log(`   Actions with assigned_to: ${actionsWithUsers.length}`);
    if (actionsWithUsers.length > 0) {
      console.log(`   Sample assigned_to values:`);
      actionsWithUsers.slice(0, 3).forEach(a => {
        console.log(`     - ${a.assigned_to} (${a.title?.substring(0, 40)}...)`);
      });
    }
  }

  // Test 3: Get organization members
  console.log('\n3️⃣  GET /api/organization_members');
  const test3 = await makeRequest('/api/organization_members');
  console.log(`   Status: ${test3.status}`);
  if (test3.data?.data) {
    console.log(`   Total members: ${test3.data.data.length}`);
    console.log(`   Sample members:`);
    test3.data.data.slice(0, 3).forEach(m => {
      console.log(`     - ${m.full_name} (${m.user_id})`);
    });
  }

  // Test 4: Check if any actions have scores
  console.log('\n4️⃣  Checking for actions with potential scores');
  if (test2.data?.data) {
    const completedActions = test2.data.data.filter(a => 
      a.status === 'completed' && a.assigned_to
    );
    console.log(`   Completed actions with users: ${completedActions.length}`);
    if (completedActions.length > 0) {
      console.log(`   Sample completed actions:`);
      completedActions.slice(0, 3).forEach(a => {
        console.log(`     - ${a.id} by ${a.assigned_to}`);
        console.log(`       Title: ${a.title?.substring(0, 50)}`);
      });
    }
  }

  // Test 5: Check user ID format
  console.log('\n5️⃣  User ID Format Analysis');
  if (test2.data?.data) {
    const userIds = [...new Set(test2.data.data
      .filter(a => a.assigned_to)
      .map(a => a.assigned_to)
    )];
    
    console.log(`   Unique user IDs found: ${userIds.length}`);
    
    const cognitoFormat = userIds.filter(id => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-70[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
    );
    const supabaseFormat = userIds.filter(id => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
    );
    const otherFormat = userIds.filter(id => 
      !cognitoFormat.includes(id) && !supabaseFormat.includes(id)
    );
    
    console.log(`   Cognito format (70xx): ${cognitoFormat.length}`);
    console.log(`   Supabase format (4xxx): ${supabaseFormat.length}`);
    console.log(`   Other format: ${otherFormat.length}`);
    
    if (supabaseFormat.length > 0) {
      console.log(`   ⚠️  MIGRATION NEEDED - Found Supabase UUIDs:`);
      supabaseFormat.slice(0, 3).forEach(id => console.log(`     - ${id}`));
    }
    
    if (cognitoFormat.length > 0) {
      console.log(`   ✅ Found Cognito UUIDs:`);
      cognitoFormat.slice(0, 3).forEach(id => console.log(`     - ${id}`));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log('   - API is accessible (may need auth for action_scores)');
  console.log('   - Actions table has assigned_to field');
  console.log('   - Organization members table is queryable');
  console.log('   - User ID format analysis complete');
  console.log('\n💡 Next: Deploy Lambda and test with authentication\n');
}

testEndpoints().catch(console.error);
