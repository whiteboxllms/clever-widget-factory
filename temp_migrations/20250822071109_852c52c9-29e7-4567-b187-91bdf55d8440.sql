-- Update the check constraint to include new issue types
ALTER TABLE tool_issues DROP CONSTRAINT valid_severity_values;

-- Add updated constraint with all issue types
ALTER TABLE tool_issues ADD CONSTRAINT valid_issue_types 
CHECK (issue_type = ANY (ARRAY['safety'::text, 'efficiency'::text, 'cosmetic'::text, 'preventative_maintenance'::text, 'functionality'::text]));