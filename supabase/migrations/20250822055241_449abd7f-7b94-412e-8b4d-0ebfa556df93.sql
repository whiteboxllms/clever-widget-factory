-- Add fields to tool_issue_history for granular change tracking
ALTER TABLE tool_issue_history 
ADD COLUMN field_changed text,
ADD COLUMN old_value text,
ADD COLUMN new_value text;