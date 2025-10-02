-- First, update any existing 'good' values to 'no_problems_observed'
UPDATE tool_audits 
SET condition_found = 'no_problems_observed' 
WHERE condition_found = 'good';

-- Drop the existing constraint
ALTER TABLE tool_audits DROP CONSTRAINT IF EXISTS tool_audits_condition_found_check;

-- Add the correct constraint with proper enum values
ALTER TABLE tool_audits 
ADD CONSTRAINT tool_audits_condition_found_check 
CHECK (condition_found IN ('no_problems_observed', 'functional_but_not_efficient', 'not_functional', 'missing'));