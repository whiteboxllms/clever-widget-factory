#!/usr/bin/env node

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const LAMBDA_FUNCTION_NAME = 'cwf-db-migration';

async function checkAllMembersStatus() {
  console.log('🔍 Checking all organization members status...');
  
  try {
    // Get all members with their is_active status (checking both boolean and string)
    const allMembersSql = `
      SELECT 
        id,
        cognito_user_id,
        user_id,
        full_name,
        role,
        is_active,
        is_active::text as is_active_text,
        organization_id,
        updated_at
      FROM organization_members 
      WHERE organization_id = '00000000-0000-0000-0000-000000000001'
      ORDER BY full_name;
    `;
    
    const params = {
      FunctionName: LAMBDA_FUNCTION_NAME,
      Payload: JSON.stringify({ sql: allMembersSql })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    const data = JSON.parse(response.body);
    
    console.log(`\n📋 All members in organization 00000000-0000-0000-0000-000000000001:\n`);
    if (data.rows && data.rows.length > 0) {
      console.table(data.rows);
      
      // Check for inactive
      const inactive = data.rows.filter(row => {
        // Check both boolean false and string 'false'
        return row.is_active === false || row.is_active === 'false' || row.is_active_text === 'false';
      });
      
      if (inactive.length > 0) {
        console.log(`\n⚠️  Found ${inactive.length} inactive member(s):`);
        inactive.forEach(member => {
          console.log(`   - ${member.full_name || member.cognito_user_id || member.user_id}`);
          console.log(`     Role: ${member.role}, is_active: ${member.is_active} (${typeof member.is_active})`);
          console.log(`     ID: ${member.id}`);
        });
      } else {
        console.log('\n✅ All members are active');
      }
      
      // Check Stefan specifically
      const stefan = data.rows.find(row => 
        row.cognito_user_id === 'stefan@stargazer-farm.com' || 
        (row.full_name && row.full_name.toLowerCase().includes('stefan'))
      );
      
      if (stefan) {
        console.log(`\n🔍 Stefan's status:`);
        console.log(`   Full Name: ${stefan.full_name}`);
        console.log(`   Cognito User ID: ${stefan.cognito_user_id}`);
        console.log(`   Role: ${stefan.role}`);
        console.log(`   Is Active: ${stefan.is_active} (type: ${typeof stefan.is_active})`);
        console.log(`   Is Active Text: ${stefan.is_active_text}`);
        if (stefan.is_active === false || stefan.is_active === 'false') {
          console.log(`   ❌ Stefan is INACTIVE!`);
        } else {
          console.log(`   ✅ Stefan is ACTIVE`);
        }
      }
    } else {
      console.log('❌ No members found');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

checkAllMembersStatus();
