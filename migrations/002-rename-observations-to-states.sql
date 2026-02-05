-- Migration: 002-rename-observations-to-states.sql
-- Purpose: Rename observation tables to state tables for RL alignment
-- Rationale: "State" is more accurate for the generic state capture system
--            used by both actions and observations. Aligns with RL framework
--            (Actions, Policy, State, Rewards).
-- Scope: Database schema only (Lambda and frontend updated separately)
-- Date: 2025-02-05

BEGIN;

-- Step 1: Rename tables
ALTER TABLE observations RENAME TO states;
ALTER TABLE observation_photos RENAME TO state_photos;
ALTER TABLE observation_links RENAME TO state_links;

-- Step 2: Rename columns in states table
ALTER TABLE states RENAME COLUMN observation_text TO state_text;
ALTER TABLE states RENAME COLUMN observed_by TO captured_by;
ALTER TABLE states RENAME COLUMN observed_at TO captured_at;

-- Step 3: Rename foreign key columns
ALTER TABLE state_photos RENAME COLUMN observation_id TO state_id;
ALTER TABLE state_links RENAME COLUMN observation_id TO state_id;

-- Step 4: Rename indexes
ALTER INDEX idx_observations_org RENAME TO idx_states_org;
ALTER INDEX idx_observations_observed_at RENAME TO idx_states_captured_at;
ALTER INDEX idx_observation_photos_observation RENAME TO idx_state_photos_state;
ALTER INDEX idx_observation_links_observation RENAME TO idx_state_links_state;
ALTER INDEX idx_observation_links_entity RENAME TO idx_state_links_entity;

-- Step 5: Update table comments
COMMENT ON TABLE states IS 'State capture system - records system state at a point in time with optional photos and text. Aligns with RL framework (Actions, Policy, State, Rewards). States change through actions, creating state transition sequences.';
COMMENT ON TABLE state_photos IS 'Photos associated with state captures, each with its own description in table format';
COMMENT ON TABLE state_links IS 'Flexible many-to-many linking of states to any entity type (action, part, tool, issue, field, asset). Links to actions create state transition sequences: State(before) → Action → State(after).';

-- Step 6: Update column comments
COMMENT ON COLUMN states.state_text IS 'Optional summary text describing the captured state, can be AI-generated from photo descriptions';
COMMENT ON COLUMN states.captured_by IS 'cognito_user_id of the user who captured this state';
COMMENT ON COLUMN states.captured_at IS 'Timestamp when the state was captured';
COMMENT ON COLUMN state_photos.photo_order IS 'Display order for photos (0, 1, 2...)';
COMMENT ON COLUMN state_links.entity_type IS 'Type of linked entity: action, part, tool, issue, field, asset';

-- Step 7: Verify data integrity
DO $$
DECLARE
  state_count INTEGER;
  photo_count INTEGER;
  link_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO state_count FROM states;
  SELECT COUNT(*) INTO photo_count FROM state_photos;
  SELECT COUNT(*) INTO link_count FROM state_links;
  
  RAISE NOTICE 'Migration complete: % states, % photos, % links', state_count, photo_count, link_count;
  
  IF state_count = 0 THEN
    RAISE EXCEPTION 'Migration failed: No states found after rename';
  END IF;
END $$;

COMMIT;

-- Migration completed successfully
-- Next steps:
-- 1. Verify tables renamed: SELECT table_name FROM information_schema.tables WHERE table_name IN ('states', 'state_photos', 'state_links');
-- 2. Verify columns renamed: SELECT column_name FROM information_schema.columns WHERE table_name = 'states';
-- 3. Deploy cwf-states-lambda function
-- 4. Update API Gateway endpoints
