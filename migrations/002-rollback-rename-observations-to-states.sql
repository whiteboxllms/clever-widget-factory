-- Rollback: 002-rollback-rename-observations-to-states.sql
-- Purpose: Revert state terminology migration back to observation terminology
-- Use: Only if migration needs to be rolled back due to issues
-- Date: 2025-02-05

BEGIN;

-- Rollback: Rename tables back
ALTER TABLE states RENAME TO observations;
ALTER TABLE state_photos RENAME TO observation_photos;
ALTER TABLE state_links RENAME TO observation_links;

-- Rollback: Rename columns back
ALTER TABLE observations RENAME COLUMN state_text TO observation_text;
ALTER TABLE observations RENAME COLUMN captured_by TO observed_by;
ALTER TABLE observations RENAME COLUMN captured_at TO observed_at;

ALTER TABLE observation_photos RENAME COLUMN state_id TO observation_id;
ALTER TABLE observation_links RENAME COLUMN state_id TO observation_id;

-- Rollback: Rename indexes back
ALTER INDEX idx_states_org RENAME TO idx_observations_org;
ALTER INDEX idx_states_captured_at RENAME TO idx_observations_observed_at;
ALTER INDEX idx_state_photos_state RENAME TO idx_observation_photos_observation;
ALTER INDEX idx_state_links_state RENAME TO idx_observation_links_observation;
ALTER INDEX idx_state_links_entity RENAME TO idx_observation_links_entity;

-- Rollback: Restore original comments
COMMENT ON TABLE observations IS 'Photo-first state capture system - observations are standalone, no action required';
COMMENT ON TABLE observation_photos IS 'Photos with per-photo descriptions in table format';
COMMENT ON TABLE observation_links IS 'Flexible many-to-many linking to any entity type';
COMMENT ON COLUMN observations.observation_text IS 'Optional summary text, can be AI-generated from photo descriptions';
COMMENT ON COLUMN observations.observed_by IS 'cognito_user_id of observer';
COMMENT ON COLUMN observations.observed_at IS 'Timestamp when the observation was captured';

COMMIT;

-- Rollback completed
-- Verify: SELECT table_name FROM information_schema.tables WHERE table_name IN ('observations', 'observation_photos', 'observation_links');
