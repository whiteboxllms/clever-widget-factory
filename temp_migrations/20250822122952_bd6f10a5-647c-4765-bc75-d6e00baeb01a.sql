-- Add next steps field to tool_issues table
ALTER TABLE tool_issues ADD COLUMN IF NOT EXISTS next_steps text;