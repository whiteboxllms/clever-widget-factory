#!/usr/bin/env node

/**
 * Verify the current sellable status of parts
 */

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const verifyStatus = async () => {
  console.log('🔍 Checking current sellable status...');
  
  const sql = `
    SELECT id, name, cost_per_unit, sellable, current_quantity
    FROM parts 
    WHERE name ILIKE '%vinegar%'
    ORDER BY name;
  `;

  const params = {
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  };

  try {
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      console.log('📦 Vinegar items status:');
      
      if (body.rows && body.rows.length > 0) {
        body.rows.forEach(item => {
          console.log(`\n  📋 ${item.name}`);
          console.log(`     ID: ${item.id}`);
          console.log(`     Cost: ₱${item.cost_per_unit || 0}`);
          console.log(`     Sellable: ${item.sellable ? '✅ YES' : '❌ NO'}`);
          console.log(`     Quantity: ${item.current_quantity}`);
        });
      } else {
        console.log('  No vinegar items found');
      }
    } else {
      const body = JSON.parse(response.body);
      console.error('❌ Failed to check status:', body.error);
    }
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
};

verifyStatus().catch(console.error);