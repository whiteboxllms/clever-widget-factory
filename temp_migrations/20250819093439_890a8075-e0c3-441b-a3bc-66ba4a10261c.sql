-- Fix the conflicting check constraints for issue_type
-- Remove the old constraint that doesn't include 'efficiency'
ALTER TABLE public.tool_issues DROP CONSTRAINT IF EXISTS tool_issues_severity_check;

-- Keep the correct constraint that includes 'efficiency'
-- (The 'valid_severity_values' constraint already has the correct values)