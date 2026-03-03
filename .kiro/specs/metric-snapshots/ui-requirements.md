# Metric Snapshots UI - Requirements

## Overview
Add metric measurement input to the Add Observation form for tools that have metrics defined. Users can optionally record metric values when creating or editing observations.

## Context
- Users navigate to a tool and click "Add Observation" (route: `/add-observation/:assetType/:id`)
- The AddObservation page (`src/pages/AddObservation.tsx`) currently has:
  - Photo upload section
  - Date/time picker (captured_at)
  - Text description field (observation_text)
- When the tool has metrics defined, we need to show metric input fields

## User Stories

### US1: View Metrics Section in Add Observation
**As a** farm worker  
**I want to** see metric input fields when adding an observation for a tool with metrics  
**So that** I can record measurements alongside my photos and notes

**Acceptance Criteria:**
- AC1.1: When tool has metrics defined, show "Metrics" section
- AC1.2: Metrics section appears after photos, before text description
- AC1.3: When tool has no metrics, metrics section is not shown
- AC1.4: Section shows all metrics defined for the tool

### US2: Enter Metric Values
**As a** farm worker  
**I want to** enter values for metrics  
**So that** I can record measurements

**Acceptance Criteria:**
- AC2.1: Each metric shows: name, unit (if defined), input field
- AC2.2: Input field accepts text (numeric, boolean, or text values)
- AC2.3: Metrics are optional - user can leave fields empty
- AC2.4: User can enter values for some metrics and skip others
- AC2.5: No validation on input (validation skipped for now)

### US3: Save Observation with Metrics
**As a** farm worker  
**I want to** save observations with metric measurements  
**So that** measurements are recorded in the system

**Acceptance Criteria:**
- AC3.1: When saving observation, metric values are saved to metric_snapshots table
- AC3.2: Only metrics with values entered are saved (empty fields skipped)
- AC3.3: Each metric creates one record in metric_snapshots
- AC3.4: Success message shows after save
- AC3.5: User is redirected to combined assets page after save

### US4: Edit Observation with Metrics
**As a** farm worker  
**I want to** edit metric values in existing observations  
**So that** I can correct mistakes

**Acceptance Criteria:**
- AC4.1: When editing observation, existing metric values are pre-filled
- AC4.2: User can update metric values
- AC4.3: User can add metrics that weren't measured initially
- AC4.4: User can clear metric values (delete snapshot)
- AC4.5: Saving updates existing snapshots or creates new ones

## UI Layout

### Add Observation Page Structure
```
┌─────────────────────────────────────┐
│ [Back] Add Observation              │
├─────────────────────────────────────┤
│                                     │
│ Date & Time                         │
│ [datetime picker]                   │
│                                     │
│ Photos                              │
│ [photo upload area]                 │
│ [uploaded photos]                   │
│                                     │
│ ┌─ Metrics ─────────────────────┐  │  ← NEW SECTION
│ │                               │  │
│ │ Tree Girth                    │  │
│ │ [____] cm                     │  │
│ │                               │  │
│ │ Ant Activity                  │  │
│ │ [____] low/med/high           │  │
│ │                               │  │
│ │ Nut Count                     │  │
│ │ [____] count                  │  │
│ │                               │  │
│ └───────────────────────────────┘  │
│                                     │
│ Details                             │
│ [text area]                         │
│                                     │
│ [Save Observation]                  │
└─────────────────────────────────────┘
```

## Component Design

### MetricsInput Component (NEW)
**Location:** `src/components/observations/MetricsInput.tsx`

**Props:**
```typescript
interface MetricsInputProps {
  toolId: string;
  values: Record<string, string>;  // metric_id -> value
  onChange: (values: Record<string, string>) => void;
}
```

**Behavior:**
- Fetches metrics for the tool using `useMetrics(toolId)` hook
- Displays input field for each metric
- Shows metric name and unit
- Calls onChange when user types in any field
- No validation (for now)

**UI:**
```tsx
<div className="space-y-3">
  <h3 className="text-sm font-medium">Metrics</h3>
  {metrics.map(metric => (
    <div key={metric.metric_id}>
      <Label>{metric.name}</Label>
      <Input
        type="text"
        value={values[metric.metric_id] || ''}
        onChange={(e) => handleChange(metric.metric_id, e.target.value)}
        placeholder={metric.unit || 'Enter value'}
      />
    </div>
  ))}
</div>
```

## Data Flow

### Creating Observation with Metrics
1. User enters metric values in MetricsInput component
2. Component stores values in state: `{ [metric_id]: value }`
3. User clicks "Save Observation"
4. AddObservation page:
   - Creates state record (existing flow)
   - Gets state_id from response
   - For each metric with a value:
     - POST to `/api/states/{state_id}/snapshots`
     - Body: `{ metric_id, value }`
5. Show success message
6. Redirect to combined assets

### Editing Observation with Metrics
1. Page loads existing observation (existing flow)
2. Fetch existing snapshots: GET `/api/states/{state_id}/snapshots`
3. Pre-fill metric values in MetricsInput
4. User updates values
5. On save:
   - Update state record (existing flow)
   - For each metric:
     - If value exists and snapshot exists: PUT `/api/snapshots/{snapshot_id}`
     - If value exists and no snapshot: POST `/api/states/{state_id}/snapshots`
     - If value empty and snapshot exists: DELETE `/api/snapshots/{snapshot_id}`

## API Integration

### New API Endpoints Needed
```typescript
// Get all snapshots for an observation
GET /api/states/{state_id}/snapshots
Response: {
  snapshots: [
    {
      snapshot_id: string,
      metric_id: string,
      value: string,
      notes: string | null,
      created_at: string,
      updated_at: string
    }
  ]
}

// Create snapshot
POST /api/states/{state_id}/snapshots
Body: {
  metric_id: string,
  value: string,
  notes?: string
}
Response: { snapshot: {...} }

// Update snapshot
PUT /api/snapshots/{snapshot_id}
Body: {
  value: string,
  notes?: string
}
Response: { snapshot: {...} }

// Delete snapshot
DELETE /api/snapshots/{snapshot_id}
Response: { success: true }
```

### Existing API to Use
```typescript
// Get metrics for a tool (already exists)
GET /api/tools/{tool_id}/metrics
Response: {
  metrics: [
    {
      metric_id: string,
      tool_id: string,
      name: string,
      unit: string | null,
      benchmark_value: number | null,
      details: string | null
    }
  ]
}
```

## State Management

### AddObservation Page State
```typescript
const [metricValues, setMetricValues] = useState<Record<string, string>>({});

// When editing, load existing snapshots
useEffect(() => {
  if (isEditMode && stateId) {
    fetchSnapshots(stateId).then(snapshots => {
      const values = {};
      snapshots.forEach(s => {
        values[s.metric_id] = s.value;
      });
      setMetricValues(values);
    });
  }
}, [isEditMode, stateId]);
```

## Files to Modify

### 1. src/pages/AddObservation.tsx
- Add `metricValues` state
- Add MetricsInput component between photos and text description
- Update save logic to create/update snapshots
- Load existing snapshots when editing

### 2. src/components/observations/MetricsInput.tsx (NEW)
- Create new component for metric input fields
- Use existing `useMetrics` hook to fetch metrics
- Display input field for each metric

### 3. src/services/snapshotService.ts (NEW)
- Create service for snapshot API calls
- Methods: getSnapshots, createSnapshot, updateSnapshot, deleteSnapshot

### 4. src/hooks/useSnapshots.ts (NEW)
- TanStack Query hooks for snapshots
- useSnapshots(stateId)
- useCreateSnapshot(stateId)
- useUpdateSnapshot()
- useDeleteSnapshot()

## Out of Scope (Future)
- Validation of metric values
- Showing benchmark comparison
- Metric history/trends
- Notes field for individual metrics
- Bulk entry of same value across observations
- Required metrics enforcement

## Design decisions

1. **Conditional display**: Metrics section only shows if tool has metrics defined (no empty state message)
2. **Delete functionality**: Show delete button for each metric to remove snapshot
3. **Unit display**: Follow best practice - show unit as suffix after input field
4. **Loading state**: Reuse existing loading patterns from the codebase
5. **Error handling**: Show toast message with error details if snapshot save fails

## Success Criteria

- [ ] Metrics section appears in Add Observation page for tools with metrics
- [ ] Metrics section does not appear for tools without metrics
- [ ] User can enter values for metrics
- [ ] User can save observation with metric values
- [ ] Metric snapshots are created in database
- [ ] User can edit observation and update metric values
- [ ] Existing metric values are pre-filled when editing
- [ ] Empty metric fields are skipped (no snapshot created)
