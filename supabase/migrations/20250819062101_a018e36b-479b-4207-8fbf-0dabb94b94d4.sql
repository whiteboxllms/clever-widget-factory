-- Rename severity column to issue_type in tool_issues table
ALTER TABLE public.tool_issues 
RENAME COLUMN severity TO issue_type;

-- Add blocks_checkout boolean field to tool_issues table
ALTER TABLE public.tool_issues 
ADD COLUMN blocks_checkout boolean NOT NULL DEFAULT false;

-- Add comment to clarify the new field
COMMENT ON COLUMN public.tool_issues.issue_type IS 'Type of issue: safety, efficiency, cosmetic, or maintenance';
COMMENT ON COLUMN public.tool_issues.blocks_checkout IS 'When true, this issue prevents tool checkout regardless of issue type';