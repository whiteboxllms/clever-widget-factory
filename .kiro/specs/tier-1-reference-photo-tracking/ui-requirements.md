# Requirements: Tool Metrics UI

## Overview

Add a "Metrics" section to the Edit Tool form for viewing, adding, editing, and deleting metrics for a tool. This section appears after "Accountable Person" and before "Tool Image". Metrics are only applicable for tools that have serial numbers.

## User Stories

### 1. View Metrics for a Tool
**As a** farm worker  
**I want to** see all metrics defined for a tool  
**So that** I know what measurements are being tracked

**Acceptance Criteria:**
- Edit Tool form has a new "Metrics" section after "Accountable Person" and before "Tool Image"
- Metrics section is only shown for tools that have serial numbers
- Section displays a list of all metrics for the current tool
- Each metric shows:
  - Name (prominent)
  - Unit (if defined)
  - Benchmark value (if defined) with label "Goal: {value} {unit}"
  - Details (if defined, shown as expandable/collapsible text)
- Empty state shows: "No metrics defined for this tool yet" with "Add Metric" button
- Metrics are sorted by created_at (newest first)

### 2. Add New Metric
**As a** farm worker  
**I want to** add a new metric to a tool  
**So that** I can start tracking a new measurement

**Acceptance Criteria:**
- "Add Metric" button appears below the metrics list (or in empty state)
- Clicking opens a dialog/form with fields:
  - **Name** * (text input)
    - Placeholder: "e.g., Tree Girth, Ant Activity, Nut Count"
  - **Unit** (text input)
    - Placeholder: "e.g., cm, count, low/med/high"
  - **Benchmark Value** (number input)
    - Placeholder: "e.g., 50"
  - **Details** (textarea)
    - Placeholder: "Why are you tracking this? How should it be measured?"
    - Rows: 3
- Form validation:
  - Name is required
- On save:
  - POST to `/api/tools/{tool_id}/metrics`
  - Show success toast: "Metric added"
  - Close dialog and refresh metrics list
- On cancel: Close dialog without saving

### 3. Edit Existing Metric
**As a** farm worker  
**I want to** edit a metric's details  
**So that** I can update goals or clarify measurement instructions

**Acceptance Criteria:**
- Each metric in the list has an "Edit" button (pencil icon)
- Clicking opens the same form as "Add Metric" but pre-filled with existing values
- All fields are editable
- On save:
  - PUT to `/api/tools/{tool_id}/metrics/{metric_id}`
  - Show success toast: "Metric updated"
  - Close dialog and refresh metrics list

### 4. Delete Metric
**As a** farm worker  
**I want to** delete a metric I no longer need  
**So that** the metrics list stays relevant

**Acceptance Criteria:**
- Each metric in the list has a "Delete" button (trash icon)
- Clicking shows confirmation dialog:
  - Title: "Delete Metric?"
  - Message: "Are you sure you want to delete '{name}'? This action cannot be undone."
  - Buttons: "Cancel" and "Delete" (destructive style)
- On confirm:
  - DELETE to `/api/tools/{tool_id}/metrics/{metric_id}`
  - Show success toast: "Metric deleted"
  - Refresh metrics list
- On cancel: Close dialog without deleting

## UI Layout

### Edit Tool Form - Field Order

```
Asset Name *
Description
Category
Serial Number
Status
Storage Location
Accountable Person

--- METRICS SECTION (only if serial_number exists) ---
Metrics
  ┌──────────────────────────────────────────────┐
  │ Tree Girth                    [Edit] [Delete] │
  │ Goal: 50 cm                                   │
  │ ▼ Measure at 1 meter height from ground...   │
  └──────────────────────────────────────────────┘
  
  ┌──────────────────────────────────────────────┐
  │ Ant Activity Level            [Edit] [Delete] │
  │ Unit: low/med/high                            │
  │ ▼ Visual assessment of ant presence...       │
  └──────────────────────────────────────────────┘
  
  [+ Add Metric]
--- END METRICS SECTION ---

Tool Image

[Cancel] [Save]
```

### Add/Edit Metric Dialog

```
┌─────────────────────────────────────────────────────┐
│ Add Metric                                    [X]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Name *                                             │
│  [Tree Girth________________________]               │
│                                                      │
│  Unit                                               │
│  [cm_____________________________]                  │
│                                                      │
│  Benchmark Value                                    │
│  [50_____________________________]                  │
│                                                      │
│  Details                                            │
│  [Measure at 1 meter height from ground.___]        │
│  [Goal is 50cm girth by end of year.________]       │
│  [_______________________________________]          │
│                                                      │
│                          [Cancel]  [Save Metric]    │
└─────────────────────────────────────────────────────┘
```

## Access Path

1. User navigates to http://localhost:8080/combined-assets
2. User clicks "Edit" on a tool that has a serial number
3. Edit Tool form opens
4. Metrics section appears after "Accountable Person" and before "Tool Image"
5. User can view/manage metrics inline within the form

## Conditional Display

- Metrics section is only visible for tools where `serial_number IS NOT NULL`
- If tool has no serial number, the section is not rendered

## API Requirements

### Endpoints

1. **GET /api/tools/:tool_id/metrics**
   - Returns all metrics for a tool
   - Filtered by organization_id from authorizer
   - Response: `{ metrics: Metric[] }`

2. **POST /api/tools/:tool_id/metrics**
   - Creates a new metric
   - Body: `{ name, unit?, benchmark_value?, details? }`
   - Auto-adds tool_id and organization_id from context
   - Response: `{ metric: Metric }`

3. **PUT /api/tools/:tool_id/metrics/:metric_id**
   - Updates an existing metric
   - Body: `{ name, unit?, benchmark_value?, details? }`
   - Response: `{ metric: Metric }`

4. **DELETE /api/tools/:tool_id/metrics/:metric_id**
   - Deletes a metric
   - Response: `{ success: true }`

## Component Structure

```
src/components/tools/forms/
  EditToolForm.tsx (modify - add Metrics section between Accountable Person and Tool Image)
  
src/components/tools/metrics/
  MetricsSection.tsx (new - container for metrics list)
  MetricCard.tsx (new - individual metric display)
  MetricDialog.tsx (new - add/edit form)
```

## Technical Notes

- Use TanStack Query for data fetching and caching
- Use React Hook Form + Zod for form validation
- Use shadcn/ui components (Dialog, Card, Button, Input, Textarea)
- Follow existing patterns from EditToolForm.tsx
- Check `tool.serial_number` to conditionally render Metrics section
- Metrics section should be self-contained and not interfere with main form submission

## Success Criteria

- Metrics section only appears for tools with serial numbers
- Metrics section appears in correct position (after Accountable Person, before Tool Image)
- Users can add, edit, and delete metrics without confusion
- Form validation prevents invalid data
- All operations complete in <2 seconds
- UI is consistent with existing Edit Tool form patterns
- Metrics operations do not interfere with tool save/cancel actions
