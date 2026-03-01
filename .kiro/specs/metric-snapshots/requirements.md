# Metric Snapshots - Requirements

## Overview
Enable users to record metric measurements within existing state/observation records. This supports Tier 1 data collection by allowing users to track quantitative measurements (e.g., tree girth, ant activity, nut count) alongside their qualitative observations.

## Business Context
- Tools with serial numbers can have metrics defined (e.g., "Tree Girth" with unit "cm", benchmark "50")
- Users already record observations (states) with photos and text notes
- Users need to also record quantitative metric measurements within these observations
- Each observation can include measurements for multiple metrics
- Metric measurements are tracked over time to show progress toward benchmarks

## Integration with Existing State System

### Current State System
The system already has a `states` table (called "observations" on frontend) with:
- `id` (UUID) - Primary key
- `organization_id` (UUID) - Multi-tenancy
- `state_text` (TEXT) - Observation notes
- `captured_by` (UUID) - Who recorded it
- `captured_at` (TIMESTAMP) - When it was recorded
- `created_at`, `updated_at` (TIMESTAMP)

Related tables:
- `state_photos` - Photos attached to observations
- `state_links` - Links observations to entities (tools, actions, etc.)

### Integration Approach
MetricSnapshots will reference the existing `states` table:
- Each state/observation can have zero or more metric snapshots
- Metric snapshots are optional - users can create observations without metrics
- When viewing a tool's observation history, metric measurements are shown alongside photos and notes

## User Stories

### US1: Record Metrics in Observation
**As a** farm worker  
**I want to** record metric measurements when I create an observation  
**So that** I can track quantitative data alongside my notes and photos

**Acceptance Criteria:**
- AC1.1: When creating an observation for a tool with metrics, user sees a section to enter metric values
- AC1.2: User can enter values for one or more metrics (not required to measure all)
- AC1.3: User can add optional notes specific to each metric measurement
- AC1.4: User can save observation with or without metric measurements
- AC1.5: System prevents recording the same metric twice in one observation

### US2: View Metric History
**As a** farm manager  
**I want to** view measurement history for a specific metric  
**So that** I can track progress toward benchmarks over time

**Acceptance Criteria:**
- AC2.1: User can view all measurements of a specific metric in chronological order
- AC2.2: Each measurement shows date, value, and who recorded it
- AC2.3: System displays benchmark value for comparison
- AC2.4: System indicates if current value is above/below/at benchmark
- AC2.5: User can click on a measurement to view the full observation (photos, notes, etc.)

### US3: View Observations with Metrics
**As a** farm worker  
**I want to** see metric measurements when viewing observation history  
**So that** I can see both qualitative and quantitative data together

**Acceptance Criteria:**
- AC3.1: Observation history shows which metrics were measured in each observation
- AC3.2: Metric values are displayed alongside observation text and photos
- AC3.3: Trend indicators show if values increased/decreased from previous observation
- AC3.4: User can filter observations to show only those with specific metrics

### US4: Edit Metric Measurements
**As a** farm worker  
**I want to** edit metric measurements in a recent observation  
**So that** I can correct data entry mistakes

**Acceptance Criteria:**
- AC4.1: User can edit observations they created (existing functionality)
- AC4.2: When editing, user can update metric values
- AC4.3: User can add metrics that weren't measured initially
- AC4.4: User can remove incorrect metric measurements
- AC4.5: System tracks when measurements were last updated

## Data Model

### MetricSnapshots Table (NEW)
Stores individual metric measurements within an observation/state.

**Fields:**
- `snapshot_id` (UUID, PRIMARY KEY) - Unique identifier
- `state_id` (UUID, FOREIGN KEY → states.id) - Which observation/state this measurement belongs to
- `metric_id` (UUID, FOREIGN KEY → metrics.metric_id) - Which metric is being measured
- `value` (NUMERIC, REQUIRED) - The measured value
- `notes` (TEXT, OPTIONAL) - Notes specific to this metric measurement
- `created_at` (TIMESTAMP) - When measurement was recorded
- `updated_at` (TIMESTAMP) - When measurement was last updated

**Constraints:**
- `state_id` must reference an existing state
- `metric_id` must reference an existing metric
- `value` is required (cannot be NULL)
- ON DELETE CASCADE for state_id (if observation deleted, snapshots deleted)
- ON DELETE CASCADE for metric_id (if metric definition deleted, measurements deleted)
- UNIQUE constraint on (state_id, metric_id) - can't record same metric twice in one observation

**Indexes:**
- Index on `state_id` for fast lookup of all metrics in an observation
- Index on `metric_id` for fast lookup of all measurements of a specific metric over time
- Composite index on (metric_id, created_at) for time-series queries

### Relationship to Existing Tables

```
tools (1) ──→ (many) metrics
  └─ Each tool can have multiple metric definitions

tools (1) ──→ (many) states (via state_links)
  └─ Each tool can have many observations

states (1) ──→ (many) metric_snapshots
  └─ Each observation can measure multiple metrics

metrics (1) ──→ (many) metric_snapshots
  └─ Each metric can be measured many times across observations
```

### Querying Metrics for a Tool
To get all metric measurements for a tool:
```sql
SELECT 
  ms.snapshot_id,
  ms.value,
  ms.notes as metric_notes,
  ms.created_at,
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

## Schema Changes Required

### 1. Create metric_snapshots table
```sql
CREATE TABLE metric_snapshots (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  metric_id UUID NOT NULL REFERENCES metrics(metric_id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(state_id, metric_id)
);

CREATE INDEX idx_metric_snapshots_state_id ON metric_snapshots(state_id);
CREATE INDEX idx_metric_snapshots_metric_id ON metric_snapshots(metric_id);
CREATE INDEX idx_metric_snapshots_metric_time ON metric_snapshots(metric_id, created_at);
```

## API Endpoints (Future Implementation)

### Metric Snapshots
- `GET /api/states/{state_id}/snapshots` - Get all metric measurements for an observation
- `POST /api/states/{state_id}/snapshots` - Add metric measurements to an observation
- `PUT /api/snapshots/{snapshot_id}` - Update a metric measurement
- `DELETE /api/snapshots/{snapshot_id}` - Delete a metric measurement

### Metric History
- `GET /api/metrics/{metric_id}/history` - Get all measurements of a specific metric over time
- `GET /api/tools/{tool_id}/metric-history` - Get all metric measurements for a tool

## Security & Authorization
- Users can only create snapshots for states in their organization
- Users can only edit snapshots in states they created (or if they have admin role)
- Users can view all snapshots in their organization
- Organization isolation enforced via state_id → states.organization_id

## Data Validation
- `value` must be a valid number
- `metric_id` must belong to a tool that is linked to the state (via state_links)
- Cannot create snapshot for a state that doesn't have a link to a tool with that metric

## Questions for Review

1. **Required Metrics**: Should users be required to measure ALL metrics when creating an observation, or can they measure a subset?
2. **Metric Validation**: Should we validate that the metric belongs to the tool linked in the observation?
3. **Historical Data**: Do you have existing observations where metrics were recorded in text that need to be migrated?
4. **Bulk Entry**: Should we support entering the same metric value for multiple observations at once?

## Out of Scope (Future Enhancements)
- Charts/graphs for metric trends over time
- Statistical analysis (averages, trends, predictions)
- Automated alerts when values exceed thresholds
- Bulk import of metric measurements from CSV
- Export metric data to spreadsheet
- Comparison view (side-by-side observations)

## Success Criteria
- `metric_snapshots` table created successfully with all constraints
- Can insert metric snapshots linked to existing states
- Can query all measurements for a specific metric over time
- Can query all metrics measured in a specific observation
- UNIQUE constraint prevents duplicate metric measurements in same observation
- Cascade deletes work correctly (deleting state deletes snapshots)
- Organization isolation enforced through state relationship
