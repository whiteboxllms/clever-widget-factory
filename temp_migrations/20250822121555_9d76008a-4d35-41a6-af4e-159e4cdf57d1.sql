-- Drop the old constraint if it exists
ALTER TABLE tool_issues DROP CONSTRAINT IF EXISTS valid_severity_values;

-- Create a new constraint that includes all existing and new issue types
ALTER TABLE tool_issues ADD CONSTRAINT valid_issue_types 
CHECK (issue_type IN (
  'safety', 
  'efficiency', 
  'cosmetic', 
  'maintenance',
  'preventative_maintenance', 
  'functionality', 
  'lifespan'
));