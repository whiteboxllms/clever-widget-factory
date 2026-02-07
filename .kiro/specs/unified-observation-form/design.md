# Design Document: Unified State Form

## Overview

This design document specifies the extraction of form logic from the working `StatesInline` component into a reusable `StateForm` component. The `AddObservation` page will be refactored to use this shared component, eliminating the text erasure bug and providing consistent UX across all entity types.

## Design Principles

1. **Leverage Working Code**: Extract proven form logic from StatesInline (recently developed and tested)
2. **Composition Over Duplication**: Create a composable StateForm component used by both inline and full-page contexts
3. **Props for Polymorphism**: Use entity_type and custom props to determine labels and behavior
4. **Preserve Text During Upload**: Ensure state management doesn't clear text when photos upload
5. **Consistent Layout**: Photo left (50%), text right (50%) across all contexts
6. **Minimal Changes**: Refactor existing components to use StateForm without changing external APIs

## Architecture

### Current State

**StatesInline Component** (Working, Recently Developed):
- Photo left, text right layout ✅
- Text preserved during upload ✅
- Supports text-only, photo-only, both ✅
- Entity-specific labels via props ✅
- Inline mode with form show/hide ✅
- Edit and delete functionality ✅

**AddObservation Page** (Needs Refactoring):
- Photo right, text left layout (table) ❌
- Text erasure bug during upload ❌
- Different photo layout pattern ❌
- Full-page route-based form ✅
- Navigation on save/cancel ✅

### Target State

**StateForm Component** (New, Extracted):
- Reusable form component
- Photo left, text right layout
- Text preserved during upload
- Supports inline and full-page modes
- Entity-specific customization via props
- No navigation logic (handled by parent)

**StatesInline Component** (Refactored):
- Uses StateForm internally
- Handles list display and CRUD operations
- Manages show/hide form state
- Handles cache invalidation

**AddObservation Page** (Refactored):
- Uses StateForm internally
- Handles route params and navigation
- Wraps StateForm in full-page layout
- Maps assetType to entity_type

## Component Design

### StateForm Component

**Purpose**: Reusable form for capturing state updates with photos and text.

**File**: `src/components/StateForm.tsx`

**Props Interface**:
```typescript
interface StateFormProps {
  // Required props
  entity_type: 'action' | 'part' | 'tool' | 'issue' | 'policy';
  entity_id: string;
  
  // Mode
  mode?: 'inline' | 'full-page'; // Default: 'inline'
  
  // Customization
  textLabel?: string;
  textPlaceholder?: string;
  submitButtonText?: string;
  cancelButtonText?: string;
  
  // Callbacks
  onSubmit: (data: CreateObservationData) => Promise<void>;
  onCancel: () => void;
  
  // Optional: For edit mode
  initialData?: {
    state_text?: string;
    photos?: Array<{
      photo_url: string;
      photo_description: string;
      photo_order: number;
    }>;
  };
  
  // State
  isSubmitting?: boolean;
}
```

**Default Labels by Entity Type**:
```typescript
const DEFAULT_LABELS = {
  action: {
    textLabel: 'Action and Reasoning',
    textPlaceholder: 'What did you do, and why?',
  },
  part: {
    textLabel: 'Observation Text',
    textPlaceholder: 'Describe what you observed...',
  },
  tool: {
    textLabel: 'Observation Text',
    textPlaceholder: 'Describe what you observed...',
  },
  issue: {
    textLabel: 'Issue Details',
    textPlaceholder: 'Describe the issue...',
  },
  policy: {
    textLabel: 'Policy Details',
    textPlaceholder: 'Describe the policy...',
  },
};
```

**Internal State**:
```typescript
const [stateText, setStateText] = useState(initialData?.state_text || '');
const [photos, setPhotos] = useState<PhotoState[]>(
  initialData?.photos?.map((p, i) => ({
    photo_url: p.photo_url,
    photo_description: p.photo_description,
    photo_order: i,
    previewUrl: p.photo_url,
    isExisting: true,
  })) || []
);
const [uploadingPhotos, setUploadingPhotos] = useState(false);
const [uploadProgress, setUploadProgress] = useState<string>('');
```

**Key Features**:
1. **Text Preservation**: Text state is never modified during photo upload operations
2. **Photo Preview**: Shows local preview immediately, then replaces with S3 URL
3. **Upload Progress**: Displays progress for multiple file uploads
4. **Validation**: Requires at least one of text or photos
5. **Cleanup**: Revokes object URLs on unmount and form reset

**Layout Structure**:
```tsx
<div className="space-y-4">
  {/* Photo Upload Button */}
  <div>
    <Label>Photos</Label>
    <Input type="file" multiple onChange={handlePhotoSelect} />
    <Button>Upload Photos</Button>
  </div>

  {/* Photo List (vertical) */}
  {photos.length > 0 && (
    <div className="space-y-2">
      {photos.map((photo, index) => (
        <div key={index} className="flex gap-2 border rounded p-2">
          {/* Photo Left (50%) */}
          <div className="flex-shrink-0 w-1/2">
            <img src={photo.previewUrl} className="w-full aspect-square object-cover" />
            {photo.isUploading && <LoadingSpinner />}
          </div>
          
          {/* Description Right (50%) */}
          <div className="flex-1">
            <Textarea
              value={photo.photo_description}
              onChange={(e) => handlePhotoDescriptionChange(index, e.target.value)}
              placeholder={`Description for photo ${index + 1}`}
            />
          </div>
          
          {/* Remove Button */}
          <Button onClick={() => handleRemovePhoto(index)}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  )}

  {/* Text Input */}
  <div>
    <Label>{textLabel}</Label>
    <Textarea
      value={stateText}
      onChange={(e) => setStateText(e.target.value)}
      placeholder={textPlaceholder}
      rows={mode === 'full-page' ? 4 : 3}
    />
  </div>

  {/* Action Buttons */}
  <div className="flex gap-2 justify-end">
    <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
      {cancelButtonText || 'Cancel'}
    </Button>
    <Button
      onClick={handleSubmit}
      disabled={isSubmitting || (stateText.trim().length === 0 && photos.length === 0)}
    >
      {uploadingPhotos ? (
        <>{uploadProgress}</>
      ) : isSubmitting ? (
        'Saving...'
      ) : (
        submitButtonText || 'Save Observation'
      )}
    </Button>
  </div>
</div>
```

### StatesInline Component Refactoring

**Changes**:
1. Extract form UI into StateForm component
2. Keep list display and CRUD logic
3. Manage showAddForm state
4. Handle TanStack Query mutations

**New Structure**:
```tsx
export function StatesInline({ entity_type, entity_id }: StatesInlineProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<InitialData | null>(null);
  
  const { data: states, isLoading } = useStates({ entity_type, entity_id });
  const { createState, updateState, deleteState } = useStateMutations({ entity_type, entity_id });

  const handleSubmit = async (data: CreateObservationData) => {
    if (editingStateId) {
      await updateState({ id: editingStateId, data });
    } else {
      await createState(data);
    }
    setShowAddForm(false);
    setEditingStateId(null);
    setEditingData(null);
  };

  const handleEdit = (state: Observation) => {
    setEditingStateId(state.id);
    setEditingData({
      state_text: state.observation_text,
      photos: state.photos,
    });
    setShowAddForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Add/Edit Form */}
      {showAddForm ? (
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            {editingStateId && (
              <div className="bg-primary/10 p-3 rounded-md mb-4">
                <p className="text-sm font-medium">✏️ Editing observation</p>
              </div>
            )}
            
            <StateForm
              entity_type={entity_type}
              entity_id={entity_id}
              mode="inline"
              initialData={editingData}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowAddForm(false);
                setEditingStateId(null);
                setEditingData(null);
              }}
              isSubmitting={isCreating || isUpdating}
            />
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setShowAddForm(true)}>
          <Plus /> Add Observation
        </Button>
      )}

      {/* States List (unchanged) */}
      {states?.map((state) => (
        <StateCard
          key={state.id}
          state={state}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
```

### AddObservation Page Refactoring

**Changes**:
1. Replace entire form implementation with StateForm
2. Keep route handling and navigation logic
3. Map assetType to entity_type
4. Determine labels based on entity_type

**New Structure**:
```tsx
export default function AddObservation() {
  const { assetType, id } = useParams<{ assetType: string; id: string }>();
  const navigate = useNavigate();
  const { createObservation, isCreating } = useObservationMutations();
  const { toast } = useToast();

  // Map route param to entity_type
  const entity_type = assetType === 'tools' ? 'tool' : 'part';

  const handleSubmit = async (data: CreateObservationData) => {
    try {
      await createObservation(data);
      toast({
        title: 'Observation saved',
        description: 'Your observation has been saved successfully.',
      });
      navigate('/combined-assets');
    } catch (error) {
      console.error('Failed to create observation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save observation. Please try again.',
        variant: 'destructive',
      });
      throw error; // Re-throw to keep form open
    }
  };

  const handleCancel = () => {
    navigate('/combined-assets');
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Add Observation</h1>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {entity_type === 'part' ? 'Part Observation' : 'Tool Observation'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StateForm
            entity_type={entity_type}
            entity_id={id!}
            mode="full-page"
            textLabel="Observation Details"
            textPlaceholder="Describe what you observed..."
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isCreating}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Data Flow

### Photo Upload Flow (Blocking Uploads)

**StatesInline's Approach (What We're Adopting)**:

This uses **blocking/synchronous uploads** - the user waits for uploads to complete before the form closes. This is simpler and more reliable than background uploads.

```
1. User types text → setStateText(value)
   ✅ Text stored in component state

2. User selects photos → handlePhotoSelect()
   ✅ Text state unchanged
   ✅ Store File objects in photos array
   ✅ Create local preview URLs: URL.createObjectURL(file)
   ✅ NO upload yet - just preview

3. User continues typing → setStateText(value)
   ✅ Text state still works normally
   ✅ Photos array unchanged (just File objects)

4. User clicks submit → handleSubmit()
   ✅ Validate: text OR photos required
   ✅ setUploadingPhotos(true) - disable form
   ✅ Upload photos sequentially to S3
   ✅ Show progress: "Uploading photo 1 of 3..."
   ✅ Wait for each upload to complete
   ✅ Build uploadedPhotos array with S3 URLs

5. All uploads complete → Call API
   ✅ setUploadProgress('Saving observation...')
   ✅ await onSubmit({ state_text, photos: uploadedPhotos, links })
   ✅ Wait for API response

6. Success → Reset form
   ✅ Clean up preview URLs
   ✅ setStateText(''), setPhotos([])
   ✅ Show success toast
   ✅ Parent handles navigation/refresh
```

**User Experience**:
- Submit button disabled during upload
- Progress message updates: "Uploading photo 1 of 3..." → "Uploading photo 2 of 3..." → "Saving observation..."
- Form stays open until complete
- If error occurs, form stays open with data intact
- User can cancel to abort upload

**AddObservation's Approach (What We're Replacing)**:

```
1. User types text → setObservationText(value)
   ✅ Text stored

2. User selects photos → handlePhotoUpload()
   ❌ Immediately starts uploading (parallel)
   ❌ Creates placeholders with stale index: photos.length + index
   ❌ Updates state during upload: setPhotos(prev => prev.map(...))
   ❌ Index mismatch causes state corruption
   ❌ Text may be lost due to state conflicts

3. Upload completes → setPhotos(prev => prev.map(...))
   ❌ More state updates during typing
   ❌ Text erasure bug occurs here
```

**Why Blocking Uploads Work Better**:

1. **Simpler State Management**: No state updates during upload
2. **Text Safety**: Text state never touched during upload process
3. **Predictable UX**: User knows when operation is complete
4. **Easier Error Handling**: Form stays open, user can retry
5. **No Race Conditions**: Sequential operations, no conflicts

**Note on Background Uploads**: 
An optimistic upload queue approach was explored (see `UploadQueueContext.tsx`) but abandoned due to complexity and reliability issues. The blocking approach is simpler and more reliable for this use case.

### Form Submission Flow

```
StateForm (handleSubmit)
  ↓
  Validate (text OR photos)
  ↓
  Upload new photos to S3
  ↓
  Build CreateObservationData
  ↓
  Call onSubmit(data) ← Parent-provided callback
  ↓
Parent (StatesInline or AddObservation)
  ↓
  Call mutation (createState or createObservation)
  ↓
  Handle success/error
  ↓
  Navigate or refresh list
```

## Architecture Decisions

### Decision 1: Extract Form from StatesInline (Not AddObservation)

**Context**: StatesInline was recently developed and works correctly. AddObservation has the text erasure bug.

**Decision**: Extract form logic from StatesInline into StateForm component.

**Rationale**:
- StatesInline has proven, tested code
- Text preservation works correctly
- Photo upload logic is solid
- Layout pattern is preferred (photo left, text right)

**Alternatives Considered**:
- Extract from AddObservation: Would propagate the bug
- Merge both: Would require debugging both implementations

### Decision 2: Parent Handles Submission Logic

**Context**: StatesInline needs to call mutations and refresh lists. AddObservation needs to navigate.

**Decision**: StateForm accepts `onSubmit` callback and doesn't handle mutations directly.

**Rationale**:
- Separation of concerns (form UI vs business logic)
- Parent controls what happens after submission
- Easier to test form in isolation
- Supports different submission patterns (inline vs full-page)

**Alternatives Considered**:
- Form handles mutations: Would need entity-specific logic
- Form handles navigation: Would break inline mode

### Decision 3: Mode Prop for Layout Adaptation

**Context**: Inline forms need compact styling, full-page forms need more space.

**Decision**: Add `mode` prop with 'inline' | 'full-page' values.

**Rationale**:
- Minimal prop API
- Clear intent
- Easy to extend with more modes if needed
- Allows conditional styling (e.g., textarea rows)

**Alternatives Considered**:
- Separate components: Would duplicate logic
- CSS classes only: Less explicit, harder to maintain

### Decision 4: Props Override Defaults

**Context**: Different entity types need different labels, but some contexts need custom labels.

**Decision**: Provide defaults based on entity_type, allow props to override.

**Rationale**:
- Sensible defaults reduce boilerplate
- Flexibility for special cases
- Clear precedence: props > defaults
- Follows React best practices

**Alternatives Considered**:
- Always require labels: Verbose, repetitive
- Only defaults: Not flexible enough

### Decision 5: Share Photo Upload Logic from StatesInline

**Context**: StatesInline and AddObservation have different photo upload strategies:
- **StatesInline**: Stores File objects, uploads during submit ✅
- **AddObservation**: Uploads immediately on selection, updates state during upload ❌ (causes text erasure bug)

**Decision**: Extract and share the complete photo upload logic from StatesInline, not just the state structure.

**What We Share**:

1. **Photo State Structure**:
```typescript
interface PhotoState {
  file?: File;              // For new photos (uploaded on submit)
  photo_url?: string;       // For existing photos from S3
  photo_description: string;
  photo_order: number;
  previewUrl: string;       // Local preview (from File) or S3 URL
  isExisting?: boolean;     // Track if this is an existing photo
}
```

2. **Upload Timing**: Upload photos **during submit**, not on selection
   - User selects photos → Store File objects + create local previews
   - User clicks submit → Upload files to S3 → Submit with S3 URLs
   - **Benefit**: No state updates during upload = no text erasure

3. **Preview Logic**: Show local preview immediately
```typescript
const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  const newPhotos = files.map((file, index) => ({
    file,                                    // Store File object
    photo_description: '',
    photo_order: photos.length + index,
    previewUrl: URL.createObjectURL(file)   // Local preview
  }));
  setPhotos(prev => [...prev, ...newPhotos]);
};
```

4. **Upload Logic**: Sequential upload with progress tracking
```typescript
const handleSubmit = async () => {
  setUploadingPhotos(true);
  
  const newPhotos = photos.filter(p => !p.isExisting);
  const existingPhotos = photos.filter(p => p.isExisting);
  
  // Upload new photos sequentially
  for (let i = 0; i < newPhotos.length; i++) {
    setUploadProgress(`Uploading photo ${i + 1} of ${newPhotos.length}...`);
    const result = await uploadFiles([newPhotos[i].file!], { bucket: 'cwf-uploads' });
    uploadedPhotos.push({
      photo_url: result[0].url,
      photo_description: newPhotos[i].photo_description,
      photo_order: uploadedPhotos.length
    });
  }
  
  // Add existing photos (already have S3 URLs)
  existingPhotos.forEach(photo => {
    uploadedPhotos.push({
      photo_url: photo.photo_url!,
      photo_description: photo.photo_description,
      photo_order: uploadedPhotos.length
    });
  });
  
  // Now submit with all S3 URLs
  await onSubmit({ state_text, photos: uploadedPhotos, links });
};
```

5. **Cleanup Logic**: Revoke object URLs properly
```typescript
const resetForm = () => {
  photos.forEach(p => {
    if (!p.isExisting && p.previewUrl) {
      URL.revokeObjectURL(p.previewUrl);  // Clean up local previews
    }
  });
  setPhotos([]);
  setStateText('');
};
```

**Rationale**:
- **Proven Logic**: StatesInline's approach works without bugs
- **Text Preservation**: No state updates during upload = text stays intact
- **Better UX**: User sees previews immediately, upload happens on submit
- **Simpler State**: No need to track upload progress per photo
- **Shared Code**: Same logic in StateForm, used by both StatesInline and AddObservation

**Why AddObservation's Approach Failed**:
```typescript
// ❌ BAD: Upload immediately, update state during upload
const photoIndex = photos.length + index;  // Captures stale photos.length
setPhotos(prev => prev.map((p, i) => {     // State update during upload
  if (i === photoIndex) { /* ... */ }      // Index mismatch causes bugs
}));
```

**Why StatesInline's Approach Works**:
```typescript
// ✅ GOOD: Store files, upload on submit
setPhotos(prev => [...prev, ...newPhotos]);  // Simple append, no index math
// Later, during submit:
const result = await uploadFiles([photo.file!]);  // Upload when ready
```

**Alternatives Considered**:
- Keep AddObservation's immediate upload: Would need complex state synchronization
- Hybrid approach: Unnecessary complexity, StatesInline's approach is simpler

## Error Handling

### Validation Errors

**Empty Submission**:
```typescript
if (stateText.trim().length === 0 && photos.length === 0) {
  toast({
    title: 'Validation Error',
    description: 'Please add observation text or at least one photo',
    variant: 'destructive',
  });
  return; // Keep form open
}
```

### Upload Errors

**Photo Upload Failure**:
```typescript
try {
  const uploadResults = await uploadFiles([photo.file], { bucket: 'cwf-uploads' });
  // Update photo with S3 URL
} catch (error) {
  console.error('Failed to upload photo:', error);
  // Remove failed photo from list
  setPhotos(prev => prev.filter((_, i) => i !== failedIndex));
  toast({
    title: 'Upload Failed',
    description: 'Failed to upload photo. Please try again.',
    variant: 'destructive',
  });
}
```

### Submission Errors

**API Error**:
```typescript
// In parent component (StatesInline or AddObservation)
const handleSubmit = async (data: CreateObservationData) => {
  try {
    await createObservation(data);
    // Success handling
  } catch (error) {
    console.error('Failed to save observation:', error);
    toast({
      title: 'Error',
      description: 'Failed to save observation. Please try again.',
      variant: 'destructive',
    });
    throw error; // Re-throw to keep form open
  }
};
```

## Testing Strategy

### Unit Tests for StateForm

**Test File**: `src/components/__tests__/StateForm.test.tsx`

**Test Cases**:
1. Renders with default labels based on entity_type
2. Renders with custom labels when provided
3. Preserves text during photo upload
4. Validates empty submission
5. Accepts text-only submission
6. Accepts photo-only submission
7. Accepts combined submission
8. Calls onSubmit with correct data structure
9. Calls onCancel when cancel button clicked
10. Shows upload progress during photo upload
11. Displays photo previews immediately
12. Removes photos when X button clicked
13. Updates photo descriptions
14. Disables submit during upload
15. Disables submit when isSubmitting prop is true

### Integration Tests

**Test File**: `src/components/__tests__/StateForm.integration.test.tsx`

**Test Cases**:
1. StatesInline uses StateForm correctly
2. AddObservation uses StateForm correctly
3. Text is preserved during full upload flow
4. Form resets after successful submission
5. Form stays open after submission error
6. Navigation works in AddObservation
7. List refresh works in StatesInline

### Visual Regression Tests

**Test Cases**:
1. StateForm in inline mode
2. StateForm in full-page mode
3. StateForm with photos
4. StateForm during upload
5. StateForm with validation error

## Migration Plan

### Phase 1: Create StateForm Component

**Tasks**:
1. Create `src/components/StateForm.tsx`
2. Extract form logic from StatesInline
3. Add props interface with defaults
4. Add mode prop for inline/full-page
5. Ensure text preservation during upload
6. Add unit tests

**Validation**: StateForm renders and works in isolation

### Phase 2: Refactor StatesInline

**Tasks**:
1. Import StateForm
2. Replace form UI with StateForm component
3. Keep list display and CRUD logic
4. Pass appropriate props to StateForm
5. Test inline mode works correctly
6. Verify existing tests still pass

**Validation**: StatesInline behavior unchanged from user perspective

### Phase 3: Refactor AddObservation

**Tasks**:
1. Import StateForm
2. Replace entire form implementation
3. Keep route handling and navigation
4. Map assetType to entity_type
5. Pass appropriate props to StateForm
6. Test full-page mode works correctly
7. Verify text preservation bug is fixed

**Validation**: AddObservation works without text erasure bug

### Phase 4: Cleanup and Documentation

**Tasks**:
1. Remove unused code from AddObservation
2. Update component documentation
3. Add Storybook stories for StateForm
4. Update integration tests
5. Verify all tests pass

**Validation**: All tests pass, no regressions

## Rollback Plan

If issues are discovered after deployment:

1. **Immediate**: Revert frontend deployment to previous version
2. **Investigation**: Review error logs and user reports
3. **Fix**: Address issues in StateForm component
4. **Test**: Run full test suite
5. **Redeploy**: Deploy fixed version

**Rollback is safe because**:
- No database changes
- No API changes
- Only frontend component refactoring
- Previous version can be restored immediately

## Success Metrics

1. **Text Preservation**: Zero reports of text erasure during photo upload
2. **Consistent UX**: Same layout and behavior across all entity types
3. **Code Reduction**: Reduced duplication between StatesInline and AddObservation
4. **Test Coverage**: 90%+ coverage for StateForm component
5. **User Satisfaction**: No increase in support tickets related to observation forms
