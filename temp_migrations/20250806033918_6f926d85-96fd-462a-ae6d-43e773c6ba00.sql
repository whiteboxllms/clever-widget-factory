-- Change quantity columns from integer to numeric(10,3) to support decimal values
ALTER TABLE parts 
ALTER COLUMN current_quantity TYPE numeric(10,3),
ALTER COLUMN minimum_quantity TYPE numeric(10,3);

-- Change history tracking columns to support decimal values
ALTER TABLE parts_history 
ALTER COLUMN old_quantity TYPE numeric(10,3),
ALTER COLUMN new_quantity TYPE numeric(10,3),
ALTER COLUMN quantity_change TYPE numeric(10,3);

-- Update mission inventory usage to support decimal quantities
ALTER TABLE mission_inventory_usage
ALTER COLUMN quantity_used TYPE numeric(10,3);