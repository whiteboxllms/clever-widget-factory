-- Convert required_tools from names to serial numbers
-- This migration adds a new column and migrates existing data

-- Add new column for serial numbers
ALTER TABLE public.actions 
ADD COLUMN required_tool_serial_numbers TEXT[] DEFAULT '{}';

-- Create a function to migrate existing data
CREATE OR REPLACE FUNCTION migrate_tool_names_to_serial_numbers()
RETURNS void AS $$
DECLARE
    action_record RECORD;
    tool_name TEXT;
    tool_serial TEXT;
    serial_numbers TEXT[];
BEGIN
    -- Loop through all actions with required_tools
    FOR action_record IN 
        SELECT id, required_tools 
        FROM actions 
        WHERE required_tools IS NOT NULL 
        AND array_length(required_tools, 1) > 0
    LOOP
        serial_numbers := '{}';
        
        -- For each tool name in the action
        FOREACH tool_name IN ARRAY action_record.required_tools
        LOOP
            -- Trim whitespace and find matching tool by name
            SELECT serial_number INTO tool_serial
            FROM tools 
            WHERE TRIM(name) = TRIM(tool_name)
            AND serial_number IS NOT NULL
            LIMIT 1;
            
            -- If we found a matching serial number, add it to the array
            IF tool_serial IS NOT NULL THEN
                serial_numbers := array_append(serial_numbers, tool_serial);
            END IF;
        END LOOP;
        
        -- Update the action with the serial numbers
        UPDATE actions 
        SET required_tool_serial_numbers = serial_numbers
        WHERE id = action_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_tool_names_to_serial_numbers();

-- Drop the migration function
DROP FUNCTION migrate_tool_names_to_serial_numbers();

-- Add comment for documentation
COMMENT ON COLUMN public.actions.required_tool_serial_numbers IS 'Array of tool serial numbers required for this action - replaces required_tools for more reliable matching';

-- Create index for performance
CREATE INDEX idx_actions_required_tool_serial_numbers ON public.actions USING GIN (required_tool_serial_numbers);
