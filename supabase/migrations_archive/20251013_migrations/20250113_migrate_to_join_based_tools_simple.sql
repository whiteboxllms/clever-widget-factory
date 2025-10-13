-- Simple migration to populate checkouts from existing required_tool_serial_numbers
-- This creates planned checkouts for all tools currently assigned to actions

-- First, let's create checkouts for the specific action we know has tools
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
)
SELECT 
    t.id as tool_id,
    '00000000-0000-0000-0000-000000000000' as user_id,
    'System Migration' as user_name,
    a.title as intended_usage,
    'Migrated from required_tool_serial_numbers - planned checkout' as notes,
    NULL as checkout_date, -- NULL = planned checkout
    FALSE as is_returned,
    a.id as action_id,
    COALESCE(a.organization_id, '00000000-0000-0000-0000-000000000001') as organization_id
FROM actions a
CROSS JOIN LATERAL unnest(a.required_tool_serial_numbers) as tool_serial_number
JOIN tools t ON t.serial_number = tool_serial_number
WHERE a.required_tool_serial_numbers IS NOT NULL 
AND array_length(a.required_tool_serial_numbers, 1) > 0
AND NOT EXISTS (
    SELECT 1 FROM checkouts c 
    WHERE c.tool_id = t.id 
    AND c.action_id = a.id
);

-- Update tool statuses to checked_out (reserved)
UPDATE tools 
SET status = 'checked_out' 
WHERE id IN (
    SELECT DISTINCT t.id
    FROM actions a
    CROSS JOIN LATERAL unnest(a.required_tool_serial_numbers) as tool_serial_number
    JOIN tools t ON t.serial_number = tool_serial_number
    WHERE a.required_tool_serial_numbers IS NOT NULL 
    AND array_length(a.required_tool_serial_numbers, 1) > 0
);

-- Show results
SELECT COUNT(*) as migrated_checkouts FROM checkouts WHERE notes LIKE '%Migrated from required_tool_serial_numbers%';
