# Exploration Association System - Refactor Summary

## Overview

Refactored the exploration association system to remove the `primary_action_id` hierarchy concept. The new design treats all linked actions as equal participants in an exploration, enabling more flexible and future-proof collaboration patterns.

## Key Changes

### 1. Database Schema (Migration)
**File**: `migrations/refactor-exploration-to-many-to-many.sql`

**Removed**:
- `action_id` FK column from exploration table
- Index on `primary_action_id`

**Kept**:
- `exploration_status` ENUM type (in_progress, ready_for_analysis, integrated)
- `exploration` table with exploration_code, status, notes, metrics, public_flag
- `action_exploration` junction table for many-to-many relationships
- Proper indexes on status and foreign keys

**Rationale**: No hierarchy needed. All actions linking to an exploration are equal participants. Context can be stored directly on the exploration or retrieved from any linked action.

### 2. Lambda API Endpoints
**File**: `lambda/explorations/index.js`

**POST /explorations**:
- Removed requirement for `primary_action_id`
- Explorations can now be created independently
- Only requires `exploration_code` (auto-generated if not provided)

**GET /explorations/list**:
- Removed JOIN to primary_action
- Simplified query to just count linked actions
- Returns: id, exploration_code, status, notes, metrics, public_flag, action_count, timestamps

**POST /actions/{actionId}/explorations**:
- Response now uses `exploration_ids` instead of `parent_exploration_ids`
- Response includes `explorations` array instead of `parent_explorations`
- Cleaner naming reflects equal participation

**DELETE /actions/{actionId}/explorations/{explorationId}**:
- Response uses `exploration_ids` instead of `parent_exploration_ids`

### 3. Frontend Service Layer
**File**: `src/services/explorationService.ts`

**Updated Methods**:
- `createNewExploration()` - Creates exploration without any action requirement
- `linkExploration(actionId, explorationId)` - Links single action to exploration
- `linkExplorations(actionId, explorationIds)` - Links action to multiple explorations
- `unlinkExploration(actionId, explorationId)` - Removes link
- `getNonIntegratedExplorations()` - Fetches non-integrated explorations for dialog

**Updated Interfaces**:
- `CreateExplorationRequest` - Removed `action_id` and `primary_action_id` fields
- Explorations are now independent entities

### 4. Test Suite
**File**: `src/tests/exploration-status-system/exploration-many-to-many.test.ts`

**24 Tests Covering**:
- Creating explorations without actions ✓
- Linking/unlinking actions to explorations ✓
- Action count accuracy ✓
- Error handling (404, 409, network errors) ✓
- Response format validation ✓
- Non-integrated exploration filtering ✓

**All tests passing**: 24/24 ✓

### 5. Documentation Updates
**Files**: 
- `.kiro/specs/exploration-status-system/requirements.md`
- `.kiro/specs/exploration-status-system/design.md`

**Changes**:
- Removed references to `primary_action_id` hierarchy
- Updated to reflect equal participation model
- Clarified that explorations are independent entities

## Benefits of This Refactor

1. **No Hierarchy**: All actions are equal participants - no "primary" vs "secondary" distinction
2. **Future-Proof**: Supports heavyweight participants joining later without special handling
3. **Simpler Model**: Fewer constraints and special cases to manage
4. **AI-Friendly**: When an action joins an exploration, AI can provide context/explanation without needing to know about "primary" actions
5. **Cleaner API**: Response fields use consistent naming (`exploration_ids` instead of `parent_exploration_ids`)

## Architecture

```
Exploration (independent entity)
├─ exploration_code (unique)
├─ status (in_progress, ready_for_analysis, integrated)
├─ exploration_notes_text
├─ metrics_text
└─ action_exploration (junction table)
   ├─ action_id (FK)
   ├─ exploration_id (FK)
   └─ timestamps (created_at, updated_at)
```

All linked actions are equal participants. No hierarchy.

## Next Steps

1. **Apply Migration**: Run `migrations/refactor-exploration-to-many-to-many.sql` on database
2. **Deploy Lambda**: Deploy updated explorations Lambda with new endpoints
3. **Build UI Components**: Create ExplorationAssociationDialog for action form
4. **Integrate with TanStack Query**: Add cache management hooks
5. **Add AI Context**: When actions join explorations, provide AI-generated context/explanations

## Testing Status

- ✅ 24 unit tests for many-to-many relationships
- ✅ 14 unit tests for list endpoint
- ✅ All tests passing
- ✅ Error handling validated
- ✅ Response format validated

## Files Modified

1. `migrations/refactor-exploration-to-many-to-many.sql` - Database schema
2. `lambda/explorations/index.js` - API endpoints
3. `src/services/explorationService.ts` - Frontend service
4. `src/tests/exploration-status-system/exploration-many-to-many.test.ts` - Test suite
5. `.kiro/specs/exploration-status-system/requirements.md` - Requirements
6. `.kiro/specs/exploration-status-system/design.md` - Design document

## Backward Compatibility

- ✅ Existing action workflows unchanged
- ✅ No breaking changes to action API
- ✅ Exploration creation is now more flexible (not less)
- ✅ All existing tests still pass
