#!/usr/bin/env node

/**
 * Add sellable column to parts table using the db-migration lambda
 */

const AWS = require('aws-sdk');

// Configure AWS
const lambda = new AWS.Lambda({
  region: 'us-west-2'
});

const addSellableColumn = async () => {
  console.log('🚀 Adding sellable column to parts table...');
  
  const sql = `
    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'parts' AND column_name = 'sellable') THEN
            ALTER TABLE parts ADD COLUMN sellable BOOLEAN DEFAULT false NOT NULL;
            RAISE NOTICE 'Added sellable column to parts table';
        ELSE
            RAISE NOTICE 'Sellable column already exists';
        END IF;
    END $$;
    
    CREATE INDEX IF NOT EXISTS idx_parts_sellable ON parts(sellable);
    
    COMMENT ON COLUMN parts.sellable IS 'Controls whether part is visible to customers in sari sari store';
  `;

  const params = {
    FunctionName: 'cwf-db-migration',
    Payload: JSON.stringify({ sql })
  };

  try {
    console.log('📡 Invoking db-migration lambda...');
    const result = await lambda.invoke(params).promise();
    
    const response = JSON.parse(result.Payload);
    
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      console.log('✅ Migration successful!');
      console.log('📊 Result:', body);
      
      // Now update some sample items to be sellable
      await makeSampleItemsSellable();
      
    } else {
      const body = JSON.parse(response.body);
      console.error('❌ Migration failed:', body.error);
      if (body.detail) {
        console.error('📝 Details:', body.detail);
      }
    }
  } catch (error) {
    console.error('❌ Error invoking lambda:', error.message);
  }
};

const makeSampleItemsSellable = async () => {
  console.log('🏪 Making sample items sellable...');
  
  const sql = `
    UPDATE parts 
    SET sellable = true 
    WHERE (
      name ILIKE '%vinegar%' OR 
      name ILIKE '%spice%' OR 
      name ILIKE '%food%' OR
      description ILIKE '%food%' OR 
      description ILIKE '%consumable%'
    ) AND current_quantity > 0;
    
    SELECT name, sellable, current_quantity, cost_per_unit 
    FROM parts 
    WHERE sellable = true 
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
      console.log('✅ Sample items updated!');
      console.log('🛒 Sellable items:');
      
      if (body.rows && body.rows.length > 0) {
        body.rows.forEach(item => {
          console.log(`  - ${item.name}: ₱${item.cost_per_unit || 0} (${item.current_quantity} available)`);
        });
      } else {
        console.log('  No items found matching the criteria');
      }
    } else {
      const body = JSON.parse(response.body);
      console.error('❌ Failed to update sample items:', body.error);
    }
  } catch (error) {
    console.error('❌ Error updating sample items:', error.message);
  }
};

// Run the migration
addSellableColumn().catch(console.error);