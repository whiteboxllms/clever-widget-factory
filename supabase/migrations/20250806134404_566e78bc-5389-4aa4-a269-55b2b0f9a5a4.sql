-- Remove all existing check constraints for condition_found
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Get and drop any existing check constraints on condition_found
    FOR constraint_name IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'tool_audits' 
        AND tc.constraint_type = 'CHECK'
        AND ccu.column_name = 'condition_found'
    LOOP
        EXECUTE 'ALTER TABLE tool_audits DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

-- Update any existing data to use correct values
UPDATE tool_audits SET condition_found = 'no_problems_observed' WHERE condition_found = 'good';
UPDATE tool_audits SET condition_found = 'no_problems_observed' WHERE condition_found NOT IN ('no_problems_observed', 'functional_but_not_efficient', 'not_functional', 'missing');

-- Add the correct constraint
ALTER TABLE tool_audits 
ADD CONSTRAINT tool_audits_condition_found_check 
CHECK (condition_found IN ('no_problems_observed', 'functional_but_not_efficient', 'not_functional', 'missing'));