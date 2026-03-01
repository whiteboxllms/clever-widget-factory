# Requirements: Tool Metrics Tracking Table

## Overview

Create a database table to track metrics for tools (assets like coconut trees, equipment, etc.). This enables tracking measurements over time such as ant activity, girth, nut count, and other quantifiable observations.

## User Story

**As a** farm manager  
**I want to** define and track metrics for specific tools/assets  
**So that** I can monitor changes and progress toward goals over time

## Acceptance Criteria

1. A `metrics` table exists in the database
2. The table has all required fields with correct data types
3. The table has a foreign key relationship to the `tools` table
4. The schema can be verified via database query

## Database Schema

### Metrics Table

```sql
CREATE TABLE metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  metric_key VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50),
  benchmark_value NUMERIC,
  context TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);
```

### Field Descriptions

- **metric_id**: Unique identifier for each metric definition
- **tool_id**: Foreign key to tools table (the asset being measured)
- **metric_key**: Machine-readable key (e.g., "ant_activity", "girth", "nut_count")
- **display_name**: Human-readable name shown in UI (e.g., "Ant Activity", "Tree Girth")
- **unit**: Unit of measurement (e.g., "cm", "count", "boolean", "low/med/high")
- **benchmark_value**: Goal or target value for this metric on this specific tool
- **context**: Optional details about why this metric is being tracked, how to measure it, etc.
- **created_at**: Timestamp when metric was defined
- **organization_id**: Multi-tenancy support (required for all tables)

### Indexes

```sql
CREATE INDEX idx_metrics_tool_id ON metrics(tool_id);
CREATE INDEX idx_metrics_organization_id ON metrics(organization_id);
CREATE INDEX idx_metrics_metric_key ON metrics(metric_key);
```

## Verification Requirements

After table creation, verify:

1. Table exists: `SELECT * FROM information_schema.tables WHERE table_name = 'metrics';`
2. Columns are correct: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'metrics' ORDER BY ordinal_position;`
3. Foreign key constraints exist: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'metrics'::regclass;`
4. Indexes exist: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'metrics';`

## Example Data

```sql
-- Example: Tracking girth of coconut tree SF010326NC01
INSERT INTO metrics (tool_id, metric_key, display_name, unit, benchmark_value, context, organization_id)
VALUES (
  '<tool_uuid>',
  'girth',
  'Tree Girth',
  'cm',
  50.0,
  'Measure at 1 meter height from ground. Goal is 50cm girth by end of year.',
  '<org_uuid>'
);

-- Example: Tracking ant activity
INSERT INTO metrics (tool_id, metric_key, display_name, unit, benchmark_value, context, organization_id)
VALUES (
  '<tool_uuid>',
  'ant_activity',
  'Ant Activity Level',
  'low/med/high',
  NULL,
  'Visual assessment of ant presence. Low is goal.',
  '<org_uuid>'
);
```

## Out of Scope

- UI for creating/editing metrics (future)
- Recording actual metric values over time (future - separate `metric_observations` table)
- API endpoints for metrics CRUD operations (future)
- Metric visualization/charting (future)

## Success Criteria

- Table created successfully via migration Lambda
- All fields verified with correct data types
- Foreign key constraints working (cannot insert metric with invalid tool_id)
- Can insert and query sample metric records
