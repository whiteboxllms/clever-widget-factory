-- Rename mission_inventory_usage table to inventory_usage
ALTER TABLE mission_inventory_usage RENAME TO inventory_usage;

-- Update the foreign key constraint names to match the new table name
ALTER TABLE inventory_usage RENAME CONSTRAINT mission_inventory_usage_mission_id_fkey TO inventory_usage_mission_id_fkey;
ALTER TABLE inventory_usage RENAME CONSTRAINT mission_inventory_usage_part_id_fkey TO inventory_usage_part_id_fkey;
ALTER TABLE inventory_usage RENAME CONSTRAINT mission_inventory_usage_task_id_fkey TO inventory_usage_task_id_fkey;
ALTER TABLE inventory_usage RENAME CONSTRAINT mission_inventory_usage_used_by_fkey TO inventory_usage_used_by_fkey;

-- Update RLS policies
DROP POLICY IF EXISTS "Anyone can view mission inventory usage" ON inventory_usage;
DROP POLICY IF EXISTS "Authenticated users can track inventory usage" ON inventory_usage;

CREATE POLICY "Anyone can view inventory usage" 
ON inventory_usage 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can track inventory usage" 
ON inventory_usage 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);