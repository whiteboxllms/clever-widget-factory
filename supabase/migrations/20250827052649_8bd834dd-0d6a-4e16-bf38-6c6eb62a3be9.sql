-- Rename mission_actions table to actions for better clarity
ALTER TABLE mission_actions RENAME TO actions;

-- Update any existing indexes, constraints, or sequences that reference the old table name
-- (This will automatically handle most references, but we should be explicit about important ones)

-- Add a comment to clarify the table's purpose
COMMENT ON TABLE actions IS 'Unified actions table for all types of actions: mission, issue, asset, and policy actions';