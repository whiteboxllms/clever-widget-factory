# Background Upload Queue Implementation

## Overview

Implemented a background upload queue system for observation photos to provide the best user experience. Users can now save observations immediately without waiting for photo uploads to complete.

## Design Decision: Option C - Optimistic UI with Background Queue

**Key Benefits:**
- ✅ Immediate save - no waiting for uploads
- ✅ Photos upload in background after observation is created
- ✅ Per-image progress indicators
- ✅ Uploads continue even if user navigates away (within same session)
- ✅ Retry failed uploads individually
- ✅ Clean database - no placeholder/invalid URLs

## Architecture

### Components Created

1. **`src/contexts/UploadQueueContext.tsx`**
   - Global upload queue manager using React Context
   - Tracks pending uploads per observation
   - Handles upload lifecycle: pending → uploading → completed/failed
   - Provides retry and remove functionality
   - Dispatches custom events to trigger cache invalidation

2. **Updated `src/components/StatesInline.tsx`**
   - Modified to use upload queue instead of inline uploads
   - Shows per-image upload status in observation cards
   - Displays pending photos with progress indicators
   - Allows retry/remove for failed uploads
   - Locks editing while photos are uploading

3. **Updated `src/App.tsx`**
   - Added `UploadQueueProvider` to app context hierarchy

## User Flow

### Creating Observation with Photos

1. User selects photos → Shows previews immediately (no upload yet)
2. User types text and clicks "Save Observation"
3. Observation created with text only (no photos)
4. Toast shows: "Observation saved. Uploading N photos in background..."
5. Form resets, user can continue working
6. Photos upload in parallel in background
7. As each photo completes:
   - Observation is updated via API to add the photo
   - TanStack Query cache is invalidated
   - Photo appears in the observation card
8. Upload status shown per-image:
   - **Pending**: Gray spinner, "Waiting..."
   - **Uploading**: Blue spinner, "Uploading..."
   - **Completed**: Photo appears normally (removed from pending queue)
   - **Failed**: Red X icon with "Retry" and "Remove" buttons

### Error Handling

- **Upload fails**: Photo marked as failed, user can retry or remove
- **Network issues**: Automatic retry logic in upload function
- **User navigates away**: Uploads continue (within same session)
- **Page refresh**: Uploads are lost (by design - no IndexedDB persistence)

## Technical Details

### Upload Queue State Structure

```typescript
interface PendingPhoto {
  id: string;              // Temporary ID for tracking
  file: File;              // Original file object
  previewUrl: string;      // Blob URL for preview
  photo_description: string;
  photo_order: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

interface UploadTask {
  observationId: string;
  entity_type: string;
  entity_id: string;
  photos: PendingPhoto[];
}
```

### API Update Strategy

When a photo completes upload:
1. Fetch current observation to get existing photos
2. Append new photo to photos array
3. PUT update with all photos (existing + new)
4. Dispatch `invalidate-states` custom event
5. Component listens for event and refetches data

### Cache Invalidation

Uses custom events instead of direct TanStack Query access:
```typescript
window.dispatchEvent(new CustomEvent('invalidate-states', { 
  detail: { entity_type, entity_id } 
}));
```

Component listens and refetches:
```typescript
useEffect(() => {
  const handleInvalidate = (e: CustomEvent) => {
    if (e.detail.entity_type === entity_type && e.detail.entity_id === entity_id) {
      refetch();
    }
  };
  window.addEventListener('invalidate-states', handleInvalidate);
  return () => window.removeEventListener('invalidate-states', handleInvalidate);
}, [entity_type, entity_id, refetch]);
```

## Limitations & Future Enhancements

### Current Limitations

1. **No persistence**: Uploads lost on page refresh (by design)
2. **No editing with new photos**: Edit mode doesn't support adding photos yet
3. **Session-scoped**: Uploads don't survive browser close
4. **No global progress indicator**: Only shows in observation cards

### Future Enhancements (if needed)

1. **IndexedDB persistence**: Survive page refresh
2. **Service Worker**: Continue uploads even after browser close
3. **Global upload indicator**: Badge in app header showing all active uploads
4. **Edit mode support**: Allow adding photos when editing observations
5. **Batch updates**: Update observation once when all photos complete (instead of per-photo)
6. **Upload queue limits**: Throttle concurrent uploads if needed

## Testing Recommendations

### Manual Testing Checklist

- [ ] Create observation with text only → Saves immediately
- [ ] Create observation with 1 photo → Shows pending, then appears
- [ ] Create observation with 5 photos → All upload in parallel
- [ ] Navigate away during upload → Uploads continue
- [ ] Simulate slow network → Shows uploading status
- [ ] Simulate upload failure → Shows retry/remove buttons
- [ ] Retry failed upload → Works correctly
- [ ] Remove failed upload → Removes from queue
- [ ] Try to edit during upload → Edit button disabled
- [ ] Try to delete during upload → Delete button disabled

### Integration Testing

The existing integration tests in `src/hooks/__tests__/integration/actionStatesWorkflows.test.tsx` should be updated to test:
- Background upload queue behavior
- Pending photo display
- Retry/remove functionality
- Cache invalidation via custom events

## Performance Considerations

### Unlimited Concurrent Uploads

Decision: No throttling (unlimited parallel uploads)
- **Rationale**: Good Starlink connection can handle it
- **Benefit**: Fastest possible upload completion
- **Risk**: Could overwhelm slower connections
- **Mitigation**: Easy to add throttling later if needed

### Memory Management

- Preview URLs (`blob:`) are properly cleaned up:
  - When photo completes upload
  - When photo is removed
  - When all photos complete (task removed from queue)
- File objects held in memory until upload completes
- No memory leaks from abandoned uploads

## Configuration

No configuration needed - works out of the box with:
- Existing `useFileUpload` hook
- Existing `useStateMutations` hook
- Existing TanStack Query setup
- Existing S3 upload infrastructure

## Deployment Notes

1. Build succeeds with no errors
2. No database changes required
3. No Lambda changes required
4. No API Gateway changes required
5. Pure frontend enhancement

## User Experience Impact

**Before:**
- User selects photos → Waits for all uploads → Then can save
- Long wait times on slow connections
- Can't do anything else while uploading
- Form blocked until complete

**After:**
- User selects photos → Saves immediately → Continues working
- Photos appear one by one as they upload
- Can create multiple observations while uploads continue
- Clear feedback on upload status per photo
- Can retry failed uploads without losing work

This dramatically improves the user experience, especially for users who frequently document their work with photos.
