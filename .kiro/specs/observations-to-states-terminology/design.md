# Design Document: Database State Terminology Migration

## Overview

This design document specifies the technical approach for migrating database tables from "observation" terminology to "state" terminology, and updating the Lambda function to work with the new schema. The frontend remains unchanged and continues using "observation" terminology.

## Design Principles

1. **Zero Data Loss**: All existing data must be preserved with exact timestamps and relationships
2. **Atomic Migration**: Database changes execute in a single transaction with rollback capability
3. **Zero Downtime**: System remains operational during migration via careful deployment sequencing
4. **Backward Compatibility**: Frontend continues working without changes during and after migration

## Architecture Decisions

### Decision 1: ALTER TABLE vs CREATE/COPY/DROP

**Chosen Approach**: ALTER TABLE (rename in place)

**Rationale**:
- Faster execution (no data copying)
- Atomic operation (single transaction)
- Preserves all constraints, indexes, and relationships automatically
- Lower risk of data loss
- Simpler rollback (just rename back)

**Alternative Considered**: CREATE new tables, COPY data, DROP old tables
- Rejected: More complex, higher risk, requires more downtime

### Decision 2: Lambda Deployment Strategy

**Chosen Approach**: Deploy new Lambda alongside old, switch API Gateway, remove old

**Sequence**:
1. Deploy `cwf-states-lambda` (new function)
2. Update API Gateway to point `/states` endpoints to new function
3. Keep `/observations` endpoints pointing to old function temporarily
4. After frontend update (future), remove old function

**Rationale**:
- Allows testing new Lambda before switching traffic
- Enables instant rollback by switching API Gateway back
- No downtime during deployment

### Decision 3: API Endpoint Strategy

**Chosen Approach**: Create `/states` endpoints, keep `/observations` working

**Implementation**:
- API Gateway has both `/observations` and `/states` resources
- Both point to `cwf-states-lambda` (which queries `states` tables)
- Frontend continues calling `/observations` (works transparently)
- Future: Remove `/observations` endpoints after frontend migration

**Rationale**:
- Frontend doesn't break during backend migration
- Gradual migration path
- Easy rollback

## Database Migration Design

### Migration Script Structure

```sql
-- Migration: 002-rename-observations-to-states.sql
-- Purpose: Rename observation tables to state tables for RL alignment
-- Scope: Database schema only (Lambda and frontend updated separately)

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
COMMENT ON TABLE states IS 'State capture system - records system state at a point in time with optional photos and text. Aligns with RL framework (Actions, Policy, State, Rewards).';
COMMENT ON TABLE state_photos IS 'Photos associated with state captures, each with its own description in table format';
COMMENT ON TABLE state_links IS 'Flexible many-to-many linking of states to any entity type (action, part, tool, issue, field, asset)';

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
  SELECT COUNT(*) INTO photo_count FROM state_ph