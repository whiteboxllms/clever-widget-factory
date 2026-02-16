# Design Document: Experience Tracking System (Phase 1)

## Overview

Phase 1 focuses on the minimal foundation for experience tracking: capturing state transitions (S → S') for tools and parts. This phase establishes the database schema and basic UI for triggering experience collection, without AI computation or action inference.

### Scope

**In Scope:**
- experiences table for tracking state transitions
- experience_components junction table
- Manual experience creation from observations
- Basic UI to trigger experience collection
- Read-only experience viewing

**Out of Scope (Future Phases):**
- AI computation of E[S] and E[A]
- Action table modifications
- Hypothesis generation and validation
- Reward computation
- Automated experience creation

## Database Schema

### experiences Table

```sql
CREATE TABLE experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    CHECK (entity_type IN ('tool', 'part'))
);

CREATE INDEX idx_experiences_entity ON experiences(entity_type, entity_id);
CREATE INDEX idx_experiences_org ON experiences(organization_id);
CREATE INDEX idx_experiences_created_at ON experiences(created_at DESC);
```

**Fields:**
- `id`: Unique identifier
- `entity_type`: Type of entity ('tool' or 'part')
- `entity_id`: UUID of the entity
- `organization_id`: Organization for multi-tenancy
- `created_by`: User who created the experience
- `created_at`: Creation timestamp

### experience_components Table

```sql
CREATE TABLE experience_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experience_id UUID NOT NULL,
    component_type VARCHAR(50) NOT NULL,
    state_id UUID,
    action_id UUID,
    organization_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (experience_id) REFERENCES experiences(id) ON DELETE CASCADE,
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE,
    FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CHECK (component_type IN ('initial_state', 'action', 'final_state')),
    CHECK (
        (component_type IN ('initial_state', 'final_state') AND state_id IS NOT NULL AND action_id IS NULL) OR
        (component_type = 'action' AND action_id IS NOT NULL AND state_id IS NULL)
    )
);

CREATE INDEX idx_experience_components_experience ON experience_components(experience_id);
CREATE INDEX idx_experience_components_state ON experience_components(state_id);
CREATE INDEX idx_experience_components_action ON experience_components(action_id);
```

**Fields:**
- `id`: Unique identifier
- `experience_id`: Reference to parent experience
- `component_type`: Type of component ('initial_state', 'action', or 'final_state')
- `state_id`: Reference to states table (for initial_state and final_state)
- `action_id`: Reference to actions table (for action)
- `organization_id`: Organization for multi-tenancy
- `created_at`: Creation timestamp

**Note:** Phase 1 supports all three component types (S, A, S'). Users manually select initial state, action (optional), and final state when creating an experience.

## API Endpoints

### POST /api/experiences

Create a new experience manually.

**Request:**
```json
{
  "entity_type": "tool",
  "entity_id": "ladder-uuid",
  "initial_state_id": "state-uuid-1",
  "action_id": "action-uuid",
  "final_state_id": "state-uuid-2"
}
```

**Note:** `action_id` is optional. If not provided, the experience will only have initial and final states.

**Response:**
```json
{
  "data": {
    "id": "experience-uuid",
    "entity_type": "tool",
    "entity_id": "ladder-uuid",
    "organization_id": "org-uuid",
    "created_by": "user-uuid",
    "created_at": "2025-02-01T14:30:00Z",
    "components": {
      "initial_state": {
        "id": "component-uuid-1",
        "state_id": "state-uuid-1",
        "state": {
          "id": "state-uuid-1",
          "state_text": "Ladder in good condition",
          "captured_at": "2025-01-15T10:00:00Z",
          "photos": [...]
        }
      },
      "action": {
        "id": "component-uuid-2",
        "action_id": "action-uuid",
        "action": {
          "id": "action-uuid",
          "title": "Ladder maintenance",
          "description": "Cleaned and inspected ladder",
          "created_at": "2025-01-20T12:00:00Z"
        }
      },
      "final_state": {
        "id": "component-uuid-3",
        "state_id": "state-uuid-2",
        "state": {
          "id": "state-uuid-2",
          "state_text": "Ladder shows rust on pivot points",
          "captured_at": "2025-02-01T14:00:00Z",
          "photos": [...]
        }
      }
    }
  }
}
```

### GET /api/experiences

List experiences for an entity.

**Query Parameters:**
- `entity_type`: Filter by entity type ('tool', 'part')
- `entity_id`: Filter by entity ID
- `limit`: Number of results (default 50)
- `offset`: Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "experience-uuid",
      "entity_type": "tool",
      "entity_id": "ladder-uuid",
      "created_at": "2025-02-01T14:30:00Z",
      "components": {
        "initial_state": {...},
        "final_state": {...}
      }
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

### GET /api/experiences/:id

Retrieve a single experience with all components.

**Response:**
```json
{
  "data": {
    "id": "experience-uuid",
    "entity_type": "tool",
    "entity_id": "ladder-uuid",
    "entity": {
      "id": "ladder-uuid",
      "name": "Extension Ladder 24ft",
      "category": "Ladders"
    },
    "created_by": "user-uuid",
    "created_at": "2025-02-01T14:30:00Z",
    "components": {
      "initial_state": {...},
      "final_state": {...}
    }
  }
}
```

## Lambda Function

### cwf-experiences-lambda

New Lambda function for experience CRUD operations.

**Handler:**
```javascript
exports.handler = async (event) => {
  const { httpMethod, path, pathParameters } = event;
  const authContext = event.requestContext.authorizer;
  
  if (httpMethod === 'POST' && path === '/api/experiences') {
    return createExperience(event, authContext);
  }
  
  if (httpMethod === 'GET' && path === '/api/experiences') {
    return listExperiences(event, authContext);
  }
  
  if (httpMethod === 'GET' && pathParameters?.id) {
    return getExperience(pathParameters.id, authContext);
  }
  
  return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
};
```

## UI Components

### Experience Creation Dialog

Modal dialog for creating experiences manually.

**Location:** Accessible from tool/part detail pages

**Fields:**
- Entity (pre-filled from context)
- Initial State (dropdown of prior states for this entity)
- Action (dropdown of actions for this entity, optional)
- Final State (dropdown of recent states for this entity)

**Actions:**
- Create Experience button
- Cancel button

### Experience List View

Display experiences for a tool or part.

**Location:** Tab on tool/part detail pages

**Display:**
- List of experiences sorted by created_at descending
- Each experience shows:
  - Initial state text and date
  - Action title (if present)
  - Final state text and date
  - Created by user name
  - Created at timestamp

**Actions:**
- Click to view experience details

## Data Models

### Experience

```typescript
interface Experience {
  id: string;
  entity_type: 'tool' | 'part';
  entity_id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
  
  // Populated from joins
  entity?: Tool | Part;
  components?: {
    initial_state?: ExperienceComponent;
    action?: ExperienceComponent;
    final_state?: ExperienceComponent;
  };
}
```

### ExperienceComponent

```typescript
interface ExperienceComponent {
  id: string;
  experience_id: string;
  component_type: 'initial_state' | 'action' | 'final_state';
  state_id?: string;
  action_id?: string;
  organization_id: string;
  created_at: string;
  
  // Populated from joins
  state?: State;
  action?: Action;
}
```

## Error Handling

**Validation Errors:**
- Missing required fields → 400 Bad Request
- Invalid entity_type → 400 Bad Request
- Invalid state_id references → 400 Bad Request
- Initial and final states for different entities → 400 Bad Request

**Authorization Errors:**
- User attempts to access experience from different organization → 403 Forbidden

**Not Found Errors:**
- Experience ID not found → 404 Not Found
- Entity ID not found → 404 Not Found

## Testing Strategy

**Unit Tests:**
- Experience creation with valid inputs
- Experience creation with invalid inputs (validation)
- Experience retrieval by ID
- Experience listing with filters
- Organization isolation

**Integration Tests:**
- End-to-end experience creation flow
- Experience listing with pagination
- Multi-tenancy enforcement

## Future Phases

**Phase 2: AI Computation**
- Add E[S] and E[A] computation
- Add action components
- Add source tracking fields to states/actions

**Phase 3: Automated Experience Creation**
- Automatically create experiences when states are captured
- Infer initial states from history

**Phase 4: Rewards**
- Add reward computation
- Add scoring integration
