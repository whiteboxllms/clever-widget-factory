-- Check current constraint
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'tool_audits_condition_found_check'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Drop the existing constraint
        ALTER TABLE tool_audits DROP CONSTRAINT tool_audits_condition_found_check;
    END IF;
END $$;

-- Add the correct constraint with proper enum values
ALTER TABLE tool_audits 
ADD CONSTRAINT tool_audits_condition_found_check 
CHECK (condition_found IN ('no_problems_observed', 'functional_but_not_efficient', 'not_functional', 'missing'));