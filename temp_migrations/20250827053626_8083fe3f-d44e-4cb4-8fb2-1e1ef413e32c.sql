-- Add required_stock column to actions table
ALTER TABLE actions ADD COLUMN required_stock jsonb DEFAULT '[]'::jsonb;

-- Add comment to describe the column
COMMENT ON COLUMN actions.required_stock IS 'Array of stock items required for this action, stored as JSON objects with part_id, quantity, and part_name';