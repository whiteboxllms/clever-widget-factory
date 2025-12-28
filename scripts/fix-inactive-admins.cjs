#!/usr/bin/env node

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const LAMBDA_FUNCTION_NAME = 'cwf-db-migration';

async function fixInactiveAdmins() {
  console.log('🔍 Checking for inactive admins that should be active...');
  
  try {
    // Get all members including inactive ones
    const allMembersSql = `
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
      WHERE role = 'admin'
      ORDER BY updated_at DESC NULLS LAST;
    `;
    
    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ sql: allMembersSql })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    const data = JSON.parse(response.body);
    
    if (data.rows && data.rows.length > 0) {
      console.log(`\n📋 Found ${data.rows.length} admin member(s):\n`);
      
      const inactiveAdmins = data.rows.filter(row => {
        // Check for inactive - handle different data types
        const isInactive = row.is_active === false || 
                           row.is_active === 0 || 
                           row.is_active === 'false' ||
                           String(row.is_active).toLowerCase() === 'false';
        return isInactive;
      });
      
      if (inactiveAdmins.length > 0) {
        console.log(`⚠️  Found ${inactiveAdmins.length} inactive admin(s):\n`);
        inactiveAdmins.forEach(admin => {
          console.log(`   - ${admin.full_name || admin.cognito_user_id || admin.user_id}`);
          console.log(`     ID: ${admin.id}`);
          console.log(`     Organization: ${admin.organization_id}`);
          console.log(`     is_active: ${admin.is_active} (${typeof admin.is_active})`);
          if (admin.updated_at) {
            console.log(`     Last updated: ${admin.updated_at}`);
          }
        });
        
        console.log(`\n💡 SQL to reactivate these admins:`);
        inactiveAdmins.forEach(admin => {
          console.log(`UPDATE organization_members SET is_active = true WHERE id = '${admin.id}';`);
        });
        
        // Check specifically for stefan@stargazer-farm.com
        const stefan = data.rows.find(row => 
          row.cognito_user_id === 'stefan@stargazer-farm.com' ||
          row.cognito_user_id === '08617390-b001-708d-f61e-07a1698282ec'
        );
        
        if (stefan) {
          const stefanIsInactive = stefan.is_active === false || 
                                   stefan.is_active === 0 || 
                                   stefan.is_active === 'false' ||
                                   String(stefan.is_active).toLowerCase() === 'false';
          
          console.log(`\n🔍 Stefan's status:`);
          console.log(`   Full Name: ${stefan.full_name}`);
          console.log(`   Cognito User ID: ${stefan.cognito_user_id}`);
          console.log(`   Role: ${stefan.role}`);
          console.log(`   Is Active: ${stefan.is_active} (${typeof stefan.is_active})`);
          
          if (stefanIsInactive) {
            console.log(`   ❌ Stefan is INACTIVE!`);
            console.log(`\n💡 To fix Stefan:`);
            console.log(`UPDATE organization_members SET is_active = true WHERE id = '${stefan.id}';`);
          } else {
            console.log(`   ✅ Stefan is ACTIVE`);
          }
        }
      } else {
        console.log('✅ All admins are active');
        
        // Still check Stefan specifically
        const stefan = data.rows.find(row => 
          row.cognito_user_id === 'stefan@stargazer-farm.com' ||
          row.cognito_user_id === '08617390-b001-708d-f61e-07a1698282ec'
        );
        
        if (stefan) {
          console.log(`\n🔍 Stefan's status:`);
          console.log(`   ✅ Stefan is ACTIVE`);
          console.log(`   Full Name: ${stefan.full_name}`);
          console.log(`   Role: ${stefan.role}`);
          console.log(`   Is Active: ${stefan.is_active}`);
        }
      }
      
      // Show all admins for reference
      console.log(`\n📋 All admin members (active and inactive):`);
      data.rows.forEach(admin => {
        const status = (admin.is_active === false || admin.is_active === 0 || admin.is_active === 'false') ? '❌ INACTIVE' : '✅ ACTIVE';
        console.log(`   ${status} - ${admin.full_name || admin.cognito_user_id || admin.user_id} (${admin.role})`);
      });
      
    } else {
      console.log('❌ No admin members found');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

fixInactiveAdmins();
