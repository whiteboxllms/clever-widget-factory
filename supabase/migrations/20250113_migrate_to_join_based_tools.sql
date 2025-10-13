-- Migration to populate checkouts from existing required_tool_serial_numbers
-- This creates planned checkouts for all tools currently assigned to actions

-- First, let's see what we're working with
DO $$
DECLARE
    action_record RECORD;
    tool_record RECORD;
    checkout_count INTEGER := 0;
BEGIN
    -- Loop through all actions that have required_tool_serial_numbers
    FOR action_record IN 
        SELECT id, title, required_tool_serial_numbers, 
               COALESCE(organization_id, '00000000-0000-0000-0000-000000000001') as organization_id
        FROM actions 
        WHERE required_tool_serial_numbers IS NOT NULL 
        AND array_length(required_tool_serial_numbers, 1) > 0
    LOOP
        -- For each serial number in the action
        FOR tool_record IN 
            SELECT t.id as tool_id, t.name as tool_name, t.serial_number
            FROM tools t
            WHERE t.serial_number = ANY(action_record.required_tool_serial_numbers)
        LOOP
            -- Check if a checkout already exists for this tool and action
            IF NOT EXISTS (
                SELECT 1 FROM checkouts 
                WHERE tool_id = tool_record.tool_id 
                AND action_id = action_record.id
            ) THEN
                -- Create a planned checkout (checkout_date = NULL)
                INSERT INTO checkouts (
                    tool_id,
                    user_id,
                    user_name,
                    intended_usage,
                    notes,
                    checkout_date,
                    is_returned,
                    action_id,
                    organization_id
                ) VALUES (
                    tool_record.tool_id,
                    '00000000-0000-0000-0000-000000000000', -- System user ID
                    'System Migration',
                    action_record.title,
                    'Migrated from required_tool_serial_numbers - planned checkout',
                    NULL, -- NULL = planned checkout
                    FALSE,
                    action_record.id,
                    COALESCE(action_record.organization_id, '00000000-0000-0000-0000-000000000001')
                );
                
                checkout_count := checkout_count + 1;
                
                -- Update tool status to checked_out (reserved)
                UPDATE tools 
                SET status = 'checked_out' 
                WHERE id = tool_record.tool_id;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % planned checkouts from required_tool_serial_numbers', checkout_count;
END $$;

-- Add comment explaining the migration
COMMENT ON TABLE public.checkouts IS 'Tool checkouts - now the single source of truth for tool assignments to actions';
