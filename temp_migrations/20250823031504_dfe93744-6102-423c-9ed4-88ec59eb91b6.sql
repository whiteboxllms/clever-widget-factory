-- Rename mission_tasks table to mission_actions
ALTER TABLE mission_tasks RENAME TO mission_actions;

-- Update any sequences or indexes that reference the old table name
-- (The existing indexes and constraints should automatically be renamed)

-- Update any views or functions that might reference the old table name
-- (Currently there don't appear to be any custom views or functions referencing this table)

-- Add comment to clarify the table's purpose
COMMENT ON TABLE mission_actions IS 'Actions represent the smallest unit of actionable work that can be assigned to people when issues arise';