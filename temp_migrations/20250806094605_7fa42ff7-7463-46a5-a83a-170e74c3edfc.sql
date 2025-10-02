-- Update tool_audits table (text field)
UPDATE public.tool_audits 
SET condition_found = 'No problems observed' 
WHERE condition_found = 'good' OR condition_found = 'Good';

-- Update the enum type to replace 'good' with 'No problems observed'
ALTER TYPE tool_condition RENAME VALUE 'good' TO 'no_problems_observed';

-- Update tools table (this will automatically use the new enum value)
-- Since we renamed the enum value, existing 'good' values are now 'no_problems_observed'

-- Update checkins table (this will automatically use the new enum value)
-- Since we renamed the enum value, existing 'good' values are now 'no_problems_observed'