# Design Document: Exploration Association System

## Overview

This design implements the exploration association feature that allows users to link actions with explorations. The system provides a dialog-based UI for selecting or creating explorations, with immediate link persistence and TanStack Query integration for cache management.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Action Form                                                │
│  ├─ "This is an exploration" checkbox                       │
│  └─ Triggers ExplorationAssociationDialog                   │
│                                                             │
│  ExplorationAssociationDialog                              │
│  ├─ List explorations (status != 'integrated')             │
│  ├─ Create new exploration button                          │
│  ├─ Multi-select explorations                              │
│  └─ Link saved immediately on confirm                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                           │
├─────────────────────────────────────────────────────────────┤
│  ExplorationService                                         │
│  ├─ listExplorations()                                      │
│  ├─ createExploration()                                     │
│  ├─ linkExplorations() (multiple)                           │
│  └─ unlinkExploration()                                     │
│                                                             │
│  TanStack Query Integration                                │
│  ├─ Cache keys for explorations                            │
│  ├─ Optimistic updates                                     │
│  └─ Cache invalidation                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Lambda)                      │
├─────────────────────────────────────────────────────────────┤
│  GET /api/explorations/list                                 │
│  POST /api/explorations                                     │
│  POST /api/actions/{actionId}/explorations                  │
│  DELETE /api/actions/{actionId}/explorations/{explorationId}│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                          │
├─────────────────────────────────────────────────────────────┤
│  exploration table                                          │
│  ├─ id (PK)                                                 │
│  ├─ exploration_code (unique)                               │
│  ├─ status (ENUM: in_progress, ready_for_analysis, integrated)
│  ├─ exploration_notes_text                                  │
│  ├─ metrics_text                                            │
│  ├─ public_flag                                             │
│  └─ timestamps                                              │
│                                                             │
│  action_exploration junction table (many-to-many)          │
│  ├─ action_id (FK)                                          │
│  ├─ exploration_id (FK)                                     │
│  └─ timestamps (created_at, updated_at)                     │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### ExplorationAssociationDialog Component

```typescript
interface ExplorationAssociationDialogProps {
  actionId: string;
  isOpen: boolean;
  onClose: () => void;
  onLinked: (explorationId: string) => void;
}

interface DialogState {
  explorations: Exploration[];
  selectedExplorationId: string | null;
  isLoading: boolean;
  isLinking: boolean;
  error: string | null;
}

// Lifecycle:
// 1. Dialog opens → Load explorations list
// 2. User clicks "Create New Exploration" → Create exploration, add to list, auto-select
// 3. User selects exploration → Update selectedExplorationId
// 4. User clicks "Confirm" → Link exploration (API call)
// 5. On success → Close dialog, call onLinked callback
// 6. On error → Show error, keep dialog open
```

### Service Layer

```typescript
class ExplorationService {
  // List non-integrated explorations
  async listExplorations(): Promise<Exploration[]>
  
  // Create new exploration
  async createExploration(): Promise<Exploration>
  
  // Link action to exploration
  async linkExploration(actionId: string, explorationId: string): Promise<LinkResponse>
  
  // Unlink action from exploration
  async unlinkExploration(actionId: string): Promise<void>
  
  // Check if action has exploration
  async getActionExploration(actionId: string): Promise<Exploration | null>
}
```

## Data Flow

### Create and Link Flow

```
User checks "This is an exploration"
    ↓
Dialog opens, loads explorations list
    ↓
User selects exploration (or creates new one)
    ↓
User clicks "Confirm"
    ↓
linkExploration() API call
    ├─ Validate exploration exists
    ├─ Validate exploration status != 'integrated'
    ├─ Update exploration.action_id
    └─ Return updated action + exploration
    ↓
TanStack Query updates cache
    ├─ Invalidate ['explorations', 'list']
    ├─ Update ['actions', actionId]
    └─ Update ['explorations', explorationId]
    ↓
Dialog closes, onLinked callback fires
    ↓
Action form shows exploration association
```

### Create New Exploration Flow

```
User clicks "Create New Exploration"
    ↓
createExploration() API call
    ├─ Generate unique exploration code
    ├─ Create exploration with status 'in_progress'
    └─ Return new exploration
    ↓
TanStack Query updates cache
    └─ Invalidate ['explorations', 'list']
    ↓
New exploration added to list
    ↓
New exploration auto-selected
    ↓
User clicks "Confirm" to link
```

## API Contracts

### GET /explorations/list

**Query Parameters:**
- `status`: Filter by status (default: 'in_progress,ready_for_analysis')

**Response:**
```json
{
  "data": [
    {
      "id": "exp-123",
      "exploration_code": "SF010326EX01",
      "state_text": "Soil condition assessment",
      "exploration_notes_text": "Testing new fertilizer",
      "action_count": 2,
      "status": "in_progress",
      "created_at": "2026-01-18T10:00:00Z",
      "updated_at": "2026-01-18T10:00:00Z"
    }
  ],
  "total": 1,
  "timestamp": "2026-01-18T10:05:00Z"
}
```

### POST /explorations

**Request Body:**
```json
{
  // No required fields - auto-generates exploration code
}
```

**Response:**
```json
{
  "id": "exp-124",
  "exploration_code": "SF010326EX02",
  "state_text": null,
  "exploration_notes_text": null,
  "metrics_text": null,
  "public_flag": false,
  "action_count": 0,
  "status": "in_progress",
  "created_at": "2026-01-18T10:05:00Z",
  "updated_at": "2026-01-18T10:05:00Z"
}
```

### POST /actions/{actionId}/exploration

**Request Body:**
```json
{
  "exploration_id": "exp-123"
}
```

**Response:**
```json
{
  "action": {
    "id": "action-456",
    "title": "Soil test",
    "exploration_id": "exp-123",
    "is_exploration": true,
    // ... all other action fields
  },
  "exploration": {
    "id": "exp-123",
    "exploration_code": "SF010326EX01",
    "action_count": 1,
    // ... all exploration fields
  },
  "requestId": "req-abc123"
}
```

### DELETE /actions/{actionId}/exploration

**Response:**
```json
{
  "action": {
    "id": "action-456",
    "exploration_id": null,
    "is_exploration": false,
    // ... all other action fields
  },
  "requestId": "req-abc123"
}
```

## TanStack Query Integration

### Cache Keys

```typescript
// List of non-integrated explorations
['explorations', 'list', { status: 'in_progress,ready_for_analysis' }]

// Single exploration
['explorations', explorationId]

// Action with exploration
['actions', actionId]

// Action count for exploration
['explorations', explorationId, 'action_count']
```

### Query Hooks

```typescript
// List explorations
const { data: explorations } = useQuery({
  queryKey: ['explorations', 'list'],
  queryFn: () => explorationService.listExplorations(),
  staleTime: 30000, // 30 seconds
})

// Get action with exploration
const { data: action } = useQuery({
  queryKey: ['actions', actionId],
  queryFn: () => actionService.getAction(actionId),
  staleTime: 60000, // 60 seconds
})
```

### Mutation Hooks

```typescript
// Link exploration
const linkMutation = useMutation({
  mutationFn: ({ actionId, explorationId }) => 
    explorationService.linkExploration(actionId, explorationId),
  onSuccess: (data) => {
    // Update action cache
    queryClient.setQueryData(['actions', data.action.id], data.action)
    // Update exploration cache
    queryClient.setQueryData(['explorations', data.exploration.id], data.exploration)
    // Invalidate list to refresh action counts
    queryClient.invalidateQueries({ queryKey: ['explorations', 'list'] })
  },
  onError: (error) => {
    // Show error to user
    // Cache remains unchanged
  }
})

// Create exploration
const createMutation = useMutation({
  mutationFn: () => explorationService.createExploration(),
  onSuccess: (data) => {
    // Invalidate list to add new exploration
    queryClient.invalidateQueries({ queryKey: ['explorations', 'list'] })
  }
})
```

## Error Handling

### Validation Errors

| Error Code | HTTP Status | Message | Recovery |
|-----------|------------|---------|----------|
| EXPLORATION_ALREADY_EXISTS | 409 | Action already has an exploration | Disable "Create New" button |
| EXPLORATION_NOT_FOUND | 404 | Selected exploration doesn't exist | Refresh list, show error |
| EXPLORATION_INTEGRATED | 409 | Cannot link to archived exploration | Filter list, show error |
| ACTION_NOT_FOUND | 404 | Action doesn't exist | Close dialog, show error |
| INVALID_STATUS | 400 | Invalid exploration status | Log error, show generic message |
| DUPLICATE_ASSOCIATION | 409 | Action already linked to different exploration | Show current link, offer to change |

### User-Facing Error Messages

- "Failed to load explorations. Please try again."
- "This exploration is archived and cannot be modified."
- "This action already has an exploration."
- "Failed to create exploration. Please try again."
- "Failed to link exploration. Please try again."

## Testing Strategy

### Unit Tests
- Exploration code generation uniqueness
- Dialog state management (selection, loading, errors)
- Cache key generation
- Error message formatting

### Integration Tests
- Create exploration → appears in list
- Select exploration → link saves immediately
- Link fails → dialog stays open with error
- Create new → auto-selects and can be linked
- Unlink → removes association

### Property-Based Tests
- For any action, linking to exploration creates valid association
- For any exploration, action_count matches database
- For any list response, all explorations have status != 'integrated'
- For any link operation, cache is updated consistently

## Performance Considerations

- Dialog load time: < 500ms (explorations list should be small)
- Link operation: < 1s (immediate feedback)
- Cache invalidation: Targeted (not broad invalidation)
- Optimistic updates: Immediate UI feedback before API response

## Security Considerations

- Validate action ownership before linking
- Validate exploration status before linking
- Prevent linking to integrated explorations
- Log all link operations for audit trail
- Include requestId in all responses for tracing
