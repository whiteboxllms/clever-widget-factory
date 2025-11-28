#!/usr/bin/env node

/**
 * Direct API test using AWS Cognito authentication
 * This script authenticates and tests the action_scores endpoints
 */

const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const https = require('https');

const REGION = 'us-west-2';
const USER_POOL_ID = 'us-west-2_84dcGaogx';
const CLIENT_ID = '59nim1jiqcq7fuqvsu212a4f8f';
const API_BASE = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';

// Test user credentials (Stefan)
const USERNAME = 'stefan@stargazerenterprises.com';
const PASSWORD = 'Test1234!'; // Update if needed

async function getAuthToken() {
  const client = new CognitoIdentityProviderClient({ region: REGION });
  
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME,
        PASSWORD,
      },
    });

    const response = await client.send(command);
    return response.AuthenticationResult?.IdToken;
  } catch (error) {
    console.error('❌ Auth failed:', error.message);
    return null;
  }
}

function makeRequest(path, token, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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

async function runTests() {
  console.log('🔐 Authenticating...\n');
  const token = await getAuthToken();
  
  if (!token) {
    console.log('❌ Failed to authenticate. Check credentials.');
    return;
  }
  
  console.log('✅ Authenticated successfully\n');
  console.log('='.repeat(70));

  // Test 1: Get all action scores
  console.log('\n📊 Test 1: GET /api/action_scores');
  const scores = await makeRequest('/api/action_scores', token);
  console.log(`Status: ${scores.status}`);
  console.log(`Count: ${scores.data?.data?.length || 0}`);
  if (scores.data?.data?.[0]) {
    console.log('Sample score:', JSON.stringify(scores.data.data[0], null, 2).substring(0, 300));
  }

  // Test 2: Get actions
  console.log('\n📋 Test 2: GET /api/actions');
  const actions = await makeRequest('/api/actions', token);
  console.log(`Status: ${actions.status}`);
  const actionsWithUsers = actions.data?.data?.filter(a => a.assigned_to) || [];
  console.log(`Total actions: ${actions.data?.data?.length || 0}`);
  console.log(`With assigned_to: ${actionsWithUsers.length}`);
  
  // Test 3: Get organization members
  console.log('\n👥 Test 3: GET /api/organization_members');
  const members = await makeRequest('/api/organization_members', token);
  console.log(`Status: ${members.status}`);
  console.log(`Total members: ${members.data?.data?.length || 0}`);
  if (members.data?.data) {
    console.log('Members:');
    members.data.data.forEach(m => {
      console.log(`  - ${m.full_name} (${m.user_id})`);
    });
  }

  // Test 4: Analyze user IDs
  console.log('\n🔍 Test 4: User ID Format Analysis');
  const userIds = [...new Set(actionsWithUsers.map(a => a.assigned_to))];
  console.log(`Unique user IDs: ${userIds.length}`);
  
  const cognitoFormat = userIds.filter(id => 
    /^[0-9a-f]{8}-[0-9a-f]{4}-70[0-9a-f]{2}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)
  );
  const supabaseFormat = userIds.filter(id => 
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)
  );
  
  console.log(`Cognito format (70xx): ${cognitoFormat.length}`);
  console.log(`Supabase format (4xxx): ${supabaseFormat.length}`);
  
  if (cognitoFormat.length > 0) {
    console.log('✅ Cognito IDs found:');
    cognitoFormat.forEach(id => console.log(`  - ${id}`));
  }
  
  if (supabaseFormat.length > 0) {
    console.log('⚠️  Supabase IDs found (need migration):');
    supabaseFormat.forEach(id => console.log(`  - ${id}`));
  }

  // Test 5: Check for scored actions
  console.log('\n🎯 Test 5: Actions with Scores');
  if (scores.data?.data && actions.data?.data) {
    const scoredActionIds = new Set(scores.data.data.map(s => s.action_id));
    const scoredActions = actions.data.data.filter(a => scoredActionIds.has(a.id));
    console.log(`Actions with scores: ${scoredActions.length}`);
    
    if (scoredActions.length > 0) {
      console.log('Sample scored actions:');
      scoredActions.slice(0, 3).forEach(a => {
        console.log(`  - ${a.title?.substring(0, 50)} (${a.assigned_to})`);
      });
    }
  }

  // Test 6: Get scores by user
  if (cognitoFormat.length > 0) {
    const testUserId = cognitoFormat[0];
    console.log(`\n👤 Test 6: GET /api/action_scores?user_id=${testUserId}`);
    const userScores = await makeRequest(`/api/action_scores?user_id=${testUserId}`, token);
    console.log(`Status: ${userScores.status}`);
    console.log(`User's scores: ${userScores.data?.data?.length || 0}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Tests Complete!\n');
  
  // Summary
  console.log('📊 SUMMARY:');
  console.log(`  Action Scores: ${scores.data?.data?.length || 0}`);
  console.log(`  Actions: ${actions.data?.data?.length || 0}`);
  console.log(`  Actions with users: ${actionsWithUsers.length}`);
  console.log(`  Cognito IDs: ${cognitoFormat.length}`);
  console.log(`  Supabase IDs: ${supabaseFormat.length}`);
  console.log(`  Migration needed: ${supabaseFormat.length > 0 ? 'YES ⚠️' : 'NO ✅'}`);
}

runTests().catch(console.error);
