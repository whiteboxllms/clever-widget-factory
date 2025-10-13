-- Remove required_tool_serial_numbers column from actions table
-- This column is no longer needed since we now use the join-based approach with checkouts table

-- First, verify that all required_tool_serial_numbers have been migrated to checkouts
DO $$
DECLARE
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM actions 
    WHERE required_tool_serial_numbers IS NOT NULL 
    AND array_length(required_tool_serial_numbers, 1) > 0
    AND NOT EXISTS (
        SELECT 1 FROM checkouts c
        JOIN tools t ON c.tool_id = t.id
        WHERE c.action_id = actions.id
        AND t.serial_number = ANY(actions.required_tool_serial_numbers)
        AND c.is_returned = false
    );
    
    IF unmigrated_count > 0 THEN
        RAISE EXCEPTION 'Found % actions with unmigrated required_tool_serial_numbers. Please run the migration script first.', unmigrated_count;
    END IF;
    
    RAISE NOTICE 'All required_tool_serial_numbers have been migrated to checkouts. Proceeding with column removal.';
END $$;

-- Drop the column and its index
DROP INDEX IF EXISTS idx_actions_required_tool_serial_numbers;
ALTER TABLE public.actions DROP COLUMN IF EXISTS required_tool_serial_numbers;

-- Add comment explaining the change
COMMENT ON TABLE public.actions IS 'Actions table - tool assignments are now managed through the checkouts table for better consistency and audit trail';
