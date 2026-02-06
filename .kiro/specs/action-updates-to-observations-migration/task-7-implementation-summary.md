# Task 7 Implementation Summary: implementation_update_count Calculation

## Overview

Task 7 updates how `implementation_update_count` is calculated to use the new states system instead of the legacy `action_implementation_updates` table. The implementation uses a **TanStack Query-based approach** that supports offline-first architecture and optimistic updates.

## Implementation Approach

### Backend (Lambda)

**Updated Files:**
- `lambda/actions/index.js`
- `lambda/core/index.js`

**Changes:**
- Modified SQL queries to calculate `implementation_update_count` from `state_links` table instead of `action_implementation_updates`
- Uses subquery: `SELECT COUNT(*) FROM state_links WHERE entity_type='action' AND entity_id=a.id`
- Count is calculated dynamically on every query (no cached column)

**Why dynamic calculation?**
- Simpler implementation (no cache invalidation logic needed)
- Always accurate (no risk of stale cache)
- Performance impact is minimal (indexed query)
- Aligns with offline-first architecture (frontend calculates from cached data)

### Frontend (TanStack Query)

**Existing Implementation (Already Complete):**

The frontend already has the complete TanStack Query-based count implementation:

1. **StatesInline Component** (`src/components/StatesInline.tsx`):
   ```typescript
   useEffect(() => {
     if (states && onCountChange) {
       onCountChange(states.length);
     }
   }, [states, onCountChange]);
   ```
   - Automatically calls `onCountChange` when states data changes
   - Count is simply `states.length` from TanStack Query cache

2. **UnifiedActionDialog** (`src/components/UnifiedActionDialog.tsx`):
   ```typescript
   const [implementationUpdateCount, setImplementationUpdateCount] = useState<number>(0);
   
   <StatesInline
     entity_type="action"
     entity_id={action.id}
     onCountChange={(count) => {
       setImplementationUpdateCount(count);
     }}
   />
   ```
   - Maintains local state for the count
   - Updates when StatesInline reports changes
   - Used in optimistic updates

## How It Works

### Initial Load
1. Backend returns action with `implementation_update_count` calculated from `state_links`
2. Frontend initializes local state with this value
3. StatesInline fetches states and calls `onCountChange(states.length)`
4. Local state updates to match actual states count

### Creating a State
1. User creates state via StatesInline
2. TanStack Query mutation runs with optimistic update
3. States cache immediately includes new state
4. `onCountChange` fires with new count (`states.length + 1`)
5. UnifiedActionDialog updates `implementationUpdateCount` state
6. UI shows updated count immediately (before backend responds)
7. Backend confirms, cache syncs

### Deleting a State
1. User deletes state via StatesInline
2. TanStack Query mutation runs with optimistic update
3. States cache immediately removes state
4. `onCountChange` fires with new count (`states.length - 1`)
5. UnifiedActionDialog updates `implementationUpdateCount` state
6. UI shows updated count immediately
7. Backend confirms, cache syncs

### Offline Support
1. States are cached in TanStack Query
2. Count is calculated from cached data (`states.length`)
3. Works offline because no backend query needed
4. Mutations queue when offline, sync when online
5. Count updates optimistically based on queued mutations

## Benefits of This Approach

1. **Offline-First**: Count works without backend connection
2. **Optimistic Updates**: UI updates immediately, no loading states
3. **Simple**: No complex cache invalidation logic
4. **Accurate**: Count always matches actual states in cache
5. **Consistent**: Same pattern used throughout the app
6. **Performant**: No extra API calls needed for count

## Testing

The implementation can be tested by:

1. **Create state**: Count should increment immediately
2. **Delete state**: Count should decrement immediately
3. **Offline mode**: Count should still work and update
4. **Refresh**: Count should sync with backend value
5. **Multiple tabs**: Each tab maintains its own cache

## Migration Notes

- No database migration needed (no cached column)
- Backend change is backward compatible
- Frontend already has complete implementation
- No breaking changes to API

## Future Considerations

If performance becomes an issue with large datasets:
- Add database index on `state_links(entity_type, entity_id)`
- Consider materialized view for count aggregation
- Monitor query performance in production

For now, the dynamic calculation approach is simpler and sufficient.
