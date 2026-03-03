# Metric Snapshots Database - Requirements

## Overview
Create a database table to store metric measurements within existing state/observation records. This enables tracking measurements (numeric, boolean, or text) over time.

## State System Structure

The existing state system has three tables:
- **`states`** - Main container with captured_by, captured_at, organization_id, state_text
- **`state_photos`** - Photos linked to states via state_id
- **`state_links`** - Links states to entities (tools, actions, etc.) via entity_type and entity_id

Metric snapshots will link to the **`states`** table (the container), not state_photos.

## Table: metric_snapshots

### Purpose
Store individual metric measurements that are recorded during observation sessions (states). Each snapshot represents one measurement of one metric at a specific point in time.

### Schema

```sql
CREATE TABLE metric_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(metric_id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(state_id, metric_id)
);
```

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `snapshot_id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for this measurement |
| `state_id` | UUID | NOT NULL, FOREIGN KEY → states(id), ON DELETE CASCADE | Which state/observation this measurement belongs to |
| `metric_id` | UUID | NOT NULL, FOREIGN KEY → metrics(metric_id), ON DELETE CASCADE | Which metric is being measured |
| `value` | TEXT | NOT NULL | The measured value (numeric, boolean, or text) |
| `notes` | TEXT | OPTIONAL | Notes specific to this measurement |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | When measurement was recorded |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | When measurement was last updated |

### Design Decisions

1. **Value as TEXT**: Supports multiple data types (numeric, boolean, text)
   - Numeric: "45.5", "100"
   - Boolean: "true", "false", "yes", "no"
   - Text: "low", "medium", "high", "red", "green"
   - Application layer handles type conversion based on metric definition

2. **No captured_by/captured_at**: These already exist in the `states` table
   - Access via: `JOIN states s ON ms.state_id = s.id` then use `s.captured_by`, `s.captured_at`

3. **Links to states (not state_photos)**: `states` is the container
   - Photos are separate in `state_photos` table
   - Links to entities are in `state_links` table

### Constraints

1. **Primary Key**: `snapshot_id`
   - Uses descriptive naming (consistent with `metric_id` in metrics table)
   - Auto-generated UUID

2. **Foreign Keys**:
   - `state_id` → `states(id)` with ON DELETE CASCADE
     - If state/observation deleted, all its metric measurements are deleted
   - `metric_id` → `metrics(metric_id)` with ON DELETE CASCADE
     - If metric definition deleted, all measurements of that metric are deleted

3. **Unique Constraint**: `UNIQUE(state_id, metric_id)`
   - Prevents recording the same metric twice in one observation
   - Ensures data integrity

4. **NOT NULL**: `state_id`, `metric_id`, `value`
   - Every measurement must be linked to a state
   - Every measurement must reference a metric definition
   - Every measurement must have a value

### Indexes

```sql
CREATE INDEX idx_metric_snapshots_state_id ON metric_snapshots(state_id);
CREATE INDEX idx_metric_snapshots_metric_id ON metric_snapshots(metric_id);
CREATE INDEX idx_metric_snapshots_metric_time ON metric_snapshots(metric_id, created_at);
```

**Purpose of each index:**

1. **idx_metric_snapshots_state_id**: Fast lookup of all metrics measured in a specific observation
   - Query: "Show me all measurements from this observation"
   
2. **idx_metric_snapshots_metric_id**: Fast lookup of all measurements of a specific metric
   - Query: "Show me all measurements of tree girth over time"
   
3. **idx_metric_snapshots_metric_time**: Composite index for time-series queries
   - Query: "Show me tree girth measurements in chronological order"
   - Optimizes ORDER BY created_at when filtering by metric_id

## Relationships

```
states (1) ──→ (many) metric_snapshots
  └─ Each observation can have multiple metric measurements
  └─ States table provides captured_by, captured_at, organization_id

metrics (1) ──→ (many) metric_snapshots
  └─ Each metric definition can have many measurements over time
```

## Example Queries

### Insert a metric measurement
```sql
INSERT INTO metric_snapshots (state_id, metric_id, value, notes)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- state_id
  '987fcdeb-51a2-43f7-8b9c-123456789abc',  -- metric_id
  '45.5',                                   -- value (stored as text)
  'Measured at base of tree'                -- notes (optional)
);
```

### Get all measurements for an observation (with captured_by/captured_at from states)
```sql
SELECT 
  ms.snapshot_id,
  ms.value,
  ms.notes,
  m.name as metric_name,
  m.unit,
  m.benchmark_value,
  s.captured_by,
  s.captured_at,
  s.state_text
FROM metric_snapshots ms
JOIN metrics m ON ms.metric_id = m.metric_id
JOIN states s ON ms.state_id = s.id
WHERE ms.state_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY m.name;
```

### Get measurement history for a specific metric
```sql
SELECT 
  ms.snapshot_id,
  ms.value,
  ms.notes,
  s.captured_at,
  s.captured_by,
  s.state_text
FROM metric_snapshots ms
JOIN states s ON ms.state_id = s.id
WHERE ms.metric_id = '987fcdeb-51a2-43f7-8b9c-123456789abc'
  AND s.organization_id = '{org_id}'
ORDER BY s.captured_at DESC;
```

### Get all metric measurements for a tool
```sql
SELECT 
  ms.snapshot_id,
  ms.value,
  ms.notes as metric_notes,
  m.name as metric_name,
  m.unit,
  m.benchmark_value,
  s.state_text as observation_text,
  s.captured_at,
  s.captured_by
FROM metric_snapshots ms
JOIN metrics m ON ms.metric_id = m.metric_id
JOIN states s ON ms.state_id = s.id
JOIN state_links sl ON s.id = sl.state_id
WHERE sl.entity_type = 'tool' 
  AND sl.entity_id = '{tool_id}'
  AND s.organization_id = '{org_id}'
ORDER BY s.captured_at DESC, m.name;
```

## Data Validation Rules

1. **Value stored as TEXT**: Application layer validates based on metric type
2. **No duplicate measurements**: UNIQUE constraint prevents same metric twice in one observation
3. **Referential integrity**: Foreign keys ensure state and metric exist
4. **Cascade deletes**: Deleting state or metric definition removes related snapshots
5. **Organization isolation**: Enforced via state_id → states.organization_id

## Migration Steps

1. **Create table** with all fields and constraints
2. **Create indexes** for query performance
3. **Add comments** for documentation
4. **Verify schema** by querying information_schema
5. **Test constraints**:
   - Try inserting duplicate (state_id, metric_id) - should fail
   - Try inserting NULL value - should fail
   - Try inserting with non-existent state_id - should fail
   - Try inserting with non-existent metric_id - should fail
6. **Test cascade deletes**:
   - Delete a state, verify snapshots are deleted
   - Delete a metric, verify snapshots are deleted
7. **Test data types**:
   - Insert numeric value: "45.5"
   - Insert boolean value: "true"
   - Insert text value: "medium"

## Success Criteria

- [ ] Table created successfully with all fields
- [ ] Primary key constraint on snapshot_id works
- [ ] Foreign key to states(id) works with CASCADE delete
- [ ] Foreign key to metrics(metric_id) works with CASCADE delete
- [ ] UNIQUE constraint on (state_id, metric_id) prevents duplicates
- [ ] All three indexes created successfully
- [ ] Can insert valid metric snapshots with TEXT values
- [ ] Can query snapshots by state_id (fast)
- [ ] Can query snapshots by metric_id (fast)
- [ ] Can query snapshots by metric_id + created_at (fast)
- [ ] Can join to states table to get captured_by, captured_at, organization_id
- [ ] Deleting a state cascades to delete its snapshots
- [ ] Deleting a metric cascades to delete its snapshots

## Questions for Review

1. **Value validation**: Should we add a CHECK constraint to validate value format, or handle in application?
2. **Timestamp timezone**: Confirmed TIMESTAMP WITH TIME ZONE is correct for your system?
3. **Additional indexes**: Do you need an index on created_at alone for time-based queries?
4. **State validation**: Should we validate that the metric belongs to the tool linked in the state?
