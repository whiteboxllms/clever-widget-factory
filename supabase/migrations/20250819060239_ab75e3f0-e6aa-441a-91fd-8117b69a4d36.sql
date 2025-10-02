-- Update tool_issues severity enum values
-- First, update existing records that have 'functional' to 'efficiency'
UPDATE tool_issues 
SET severity = 'efficiency' 
WHERE severity = 'functional';

-- Add a constraint to ensure only valid severity values
ALTER TABLE tool_issues 
ADD CONSTRAINT valid_severity_values 
CHECK (severity IN ('safety', 'efficiency', 'cosmetic', 'maintenance'));

-- Update the default value for new issues
ALTER TABLE tool_issues 
ALTER COLUMN severity SET DEFAULT 'efficiency';