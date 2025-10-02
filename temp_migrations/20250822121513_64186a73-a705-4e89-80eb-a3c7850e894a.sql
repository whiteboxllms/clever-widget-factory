-- First, let's see what the current constraint looks like
-- This query will help us understand the existing constraint
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'valid_severity_values';

-- Drop the old constraint if it exists
ALTER TABLE tool_issues DROP CONSTRAINT IF EXISTS valid_severity_values;

-- Create a new constraint with all the valid issue types including the new ones
ALTER TABLE tool_issues ADD CONSTRAINT valid_issue_types 
CHECK (issue_type IN (
  'safety', 
  'efficiency', 
  'cosmetic', 
  'preventative_maintenance', 
  'functionality', 
  'lifespan'
));