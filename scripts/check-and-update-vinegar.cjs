#!/usr/bin/env node

/**
 * Check current parts and make vinegar sellable
 */

const AWS = require('aws-sdk');

const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const checkAndUpdateVinegar = async () => {
  console.log('🔍 Checking current parts...');
  
  // First, let's see what parts exist
  const checkSql = `
    SELECT id, name, description, current_quantity, cost_per_unit, sellable 
    FROM parts 
    WHERE name ILIKE '%vinegar%' OR name ILIKE '%spice%' OR description ILIKE '%vinegar%'
    ORDER BY name;
  `;

  const params = {
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql: checkSql })
  };

  try {
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      console.log('📦 Found parts:');
      
      if (body.rows && body.rows.length > 0) {
        body.rows.forEach(item => {
          console.log(`  - ID: ${item.id}`);
          console.log(`    Name: ${item.name}`);
          console.log(`    Description: ${item.description || 'N/A'}`);
          console.log(`    Quantity: ${item.current_quantity}`);
          console.log(`    Cost: $${item.cost_per_unit || 0}`);
          console.log(`    Sellable: ${item.sellable}`);
          console.log('');
        });
        
        // Update all vinegar/spice items to be sellable
        await updateVinegarItems(body.rows);
      } else {
        console.log('  No vinegar or spice items found');
        
        // Let's check all parts to see what's available
        await checkAllParts();
      }
    } else {
      const body = JSON.parse(response.body);
      console.error('❌ Failed to check parts:', body.error);
    }
  } catch (error) {
    console.error('❌ Error checking parts:', error.message);
  }
};

const updateVinegarItems = async (items) => {
  console.log('🏪 Making vinegar/spice items sellable...');
  
  const ids = items.map(item => item.id).join("','");
  const updateSql = `
    UPDATE parts 
    SET sellable = true 
    WHERE id IN ('${ids}') AND current_quantity > 0;
    
    SELECT name, sellable, current_quantity, cost_per_unit 
    FROM parts 
    WHERE id IN ('${ids}')
    ORDER BY name;
  `;

  const params = {
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql: updateSql })
  };

  try {
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      console.log('✅ Items updated!');
      console.log('🛒 Updated items:');
      
      if (body.rows && body.rows.length > 0) {
        body.rows.forEach(item => {
          console.log(`  - ${item.name}: ₱${item.cost_per_unit || 0} (${item.current_quantity} available) - Sellable: ${item.sellable}`);
        });
      }
    } else {
      const body = JSON.parse(response.body);
      console.error('❌ Failed to update items:', body.error);
    }
  } catch (error) {
    console.error('❌ Error updating items:', error.message);
  }
};

const checkAllParts = async () => {
  console.log('🔍 Checking all parts (first 10)...');
  
  const sql = `
    SELECT id, name, description, current_quantity, cost_per_unit, sellable 
    FROM parts 
    ORDER BY name 
    LIMIT 10;
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
      console.log('📦 Sample parts:');
      
      if (body.rows && body.rows.length > 0) {
        body.rows.forEach(item => {
          console.log(`  - ${item.name} (Qty: ${item.current_quantity}, Sellable: ${item.sellable})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error checking all parts:', error.message);
  }
};

// Run the check
checkAndUpdateVinegar().catch(console.error);