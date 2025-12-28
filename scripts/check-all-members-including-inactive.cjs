#!/usr/bin/env node

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const LAMBDA_FUNCTION_NAME = 'cwf-db-migration';

async function checkAllMembersIncludingInactive() {
  console.log('🔍 Checking ALL organization members (including inactive)...');
  
  try {
    // Get ALL members without filtering by is_active
    const allMembersSql = `
      SELECT 
        id,
        cognito_user_id,
        user_id,
        full_name,
        role,
        is_active,
        organization_id,
        updated_at,
        created_at
      FROM organization_members 
      WHERE organization_id = '00000000-0000-0000-0000-000000000001'
      ORDER BY is_active DESC, full_name NULLS LAST;
    `;
    
    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ sql: allMembersSql })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    // Handle different response formats
    let data;
    try {
      if (typeof response.body === 'string') {
        data = JSON.parse(response.body);
      } else {
        data = response.body;
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', JSON.stringify(response, null, 2));
      return;
    }
    
    console.log(`\n📋 Found ${data.rows?.length || 0} total members in organization 00000000-0000-0000-0000-000000000001\n`);
    
    if (data.rows && data.rows.length > 0) {
      // Separate active and inactive
      const active = data.rows.filter(row => {
        return row.is_active === true || row.is_active === 1 || row.is_active === 'true' || String(row.is_active).toLowerCase() === 'true';
      });
      
      const inactive = data.rows.filter(row => {
        return row.is_active === false || row.is_active === 0 || row.is_active === 'false' || String(row.is_active).toLowerCase() === 'false';
      });
      
      console.log(`✅ Active members: ${active.length}`);
      active.forEach(member => {
        console.log(`   - ${member.full_name || member.cognito_user_id || member.user_id} (${member.role})`);
      });
      
      if (inactive.length > 0) {
        console.log(`\n❌ Inactive members: ${inactive.length}`);
        inactive.forEach(member => {
          console.log(`   - ${member.full_name || member.cognito_user_id || member.user_id} (${member.role})`);
          console.log(`     ID: ${member.id}`);
          if (member.updated_at) {
            console.log(`     Last updated: ${member.updated_at}`);
          }
        });
        
        // Check for admins that are inactive
        const inactiveAdmins = inactive.filter(m => m.role === 'admin');
        if (inactiveAdmins.length > 0) {
          console.log(`\n⚠️  WARNING: ${inactiveAdmins.length} inactive admin(s) found!`);
          console.log(`\n💡 SQL to reactivate inactive admins:`);
          inactiveAdmins.forEach(admin => {
            console.log(`UPDATE organization_members SET is_active = true WHERE id = '${admin.id}';`);
          });
        }
      } else {
        console.log(`\n✅ No inactive members found`);
      }
      
      // Check Stefan specifically
      const stefan = data.rows.find(row => 
        row.cognito_user_id === 'stefan@stargazer-farm.com' ||
        row.cognito_user_id === '08617390-b001-708d-f61e-07a1698282ec'
      );
      
      if (stefan) {
        const stefanIsActive = stefan.is_active === true || 
                              stefan.is_active === 1 || 
                              stefan.is_active === 'true' ||
                              String(stefan.is_active).toLowerCase() === 'true';
        
        console.log(`\n🔍 Stefan's status:`);
        console.log(`   Full Name: ${stefan.full_name}`);
        console.log(`   Cognito User ID: ${stefan.cognito_user_id}`);
        console.log(`   Role: ${stefan.role}`);
        console.log(`   Is Active: ${stefan.is_active} (${typeof stefan.is_active})`);
        
        if (stefanIsActive) {
          console.log(`   ✅ Stefan is ACTIVE`);
        } else {
          console.log(`   ❌ Stefan is INACTIVE!`);
          console.log(`\n💡 To fix Stefan:`);
          console.log(`UPDATE organization_members SET is_active = true WHERE id = '${stefan.id}';`);
        }
      } else {
        console.log(`\n⚠️  Could not find Stefan in the results`);
      }
      
    } else {
      console.log('❌ No members found');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

checkAllMembersIncludingInactive();
