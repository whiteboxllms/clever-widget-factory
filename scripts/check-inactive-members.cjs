#!/usr/bin/env node

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const LAMBDA_FUNCTION_NAME = 'cwf-db-migration';

async function checkInactiveMembers() {
  console.log('🔍 Checking for inactive organization members...');
  
  try {
    // Get all inactive members
    const inactiveSql = `
      SELECT 
        id,
        cognito_user_id,
        user_id,
        full_name,
        role,
        is_active,
        organization_id,
        created_at,
        updated_at
      FROM organization_members 
      WHERE is_active = false
      ORDER BY updated_at DESC NULLS LAST, created_at DESC;
    `;
    
    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ sql: inactiveSql })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    const data = JSON.parse(response.body);
    
    console.log(`\n📋 Found ${data.rows?.length || 0} inactive members:\n`);
    if (data.rows && data.rows.length > 0) {
      console.table(data.rows);
      
      // Check for admins that are inactive
      const inactiveAdmins = data.rows.filter(row => row.role === 'admin');
      if (inactiveAdmins.length > 0) {
        console.log(`\n⚠️  WARNING: Found ${inactiveAdmins.length} inactive admin(s):`);
        inactiveAdmins.forEach(admin => {
          console.log(`   - ${admin.full_name || admin.cognito_user_id || admin.user_id} (${admin.role})`);
          console.log(`     ID: ${admin.id}`);
          console.log(`     Organization: ${admin.organization_id}`);
        });
      }
      
      // Check recently updated (might have been accidentally deactivated)
      const recentlyUpdated = data.rows.filter(row => {
        if (!row.updated_at) return false;
        const updated = new Date(row.updated_at);
        const now = new Date();
        const hoursAgo = (now - updated) / (1000 * 60 * 60);
        return hoursAgo < 24; // Updated in last 24 hours
      });
      
      if (recentlyUpdated.length > 0) {
        console.log(`\n⚠️  WARNING: ${recentlyUpdated.length} member(s) were deactivated in the last 24 hours:`);
        recentlyUpdated.forEach(member => {
          console.log(`   - ${member.full_name || member.cognito_user_id || member.user_id}`);
          console.log(`     Role: ${member.role}, Updated: ${member.updated_at}`);
        });
      }
    } else {
      console.log('✅ No inactive members found');
    }
    
    // Also check stefan specifically
    console.log('\n🔍 Checking Stefan specifically...');
    const stefanSql = `
      SELECT 
        id,
        cognito_user_id,
        user_id,
        full_name,
        role,
        is_active,
        organization_id,
        updated_at
      FROM organization_members 
      WHERE cognito_user_id = 'stefan@stargazer-farm.com'
         OR (full_name ILIKE '%stefan%' AND cognito_user_id IS NOT NULL)
      ORDER BY is_active DESC, updated_at DESC;
    `;
    
    const stefanParams = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ sql: stefanSql })
    };
    
    const stefanResult = await lambda.invoke(stefanParams).promise();
    const stefanResponse = JSON.parse(stefanResult.Payload);
    const stefanData = JSON.parse(stefanResponse.body);
    
    if (stefanData.rows && stefanData.rows.length > 0) {
      console.log('\n📋 Stefan\'s memberships:');
      stefanData.rows.forEach(row => {
        const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
        console.log(`   ${status} - ${row.full_name || row.cognito_user_id}`);
        console.log(`     Role: ${row.role}, Org: ${row.organization_id}`);
        if (row.updated_at) {
          console.log(`     Last updated: ${row.updated_at}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

checkInactiveMembers();
