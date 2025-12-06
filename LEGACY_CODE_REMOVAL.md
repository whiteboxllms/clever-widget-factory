# Legacy Storage Vicinity Code Removal

## Summary
Removed all legacy `storage_vicinity` code after successful migration to `parent_structure_id` system. This simplifies the codebase and eliminates confusion between old and new location tracking systems.

## Migration Completed
- **Date**: January 2025
- **Tools Migrated**: 55 tools mapped to parent structures
- **Success Rate**: 100% of mappable tools migrated
- **Remaining Unmapped**: 13 tools intentionally left unmapped (toolboxes, special cases)

## Files Removed
1. **`src/components/StorageVicinitySelector.tsx`** - Entire component deleted
   - Legacy selector for storage_vicinities table
   - No longer needed as all tools use parent_structure_id

## Files Modified

### Core Components
1. **`src/components/shared/LocationFieldsGroup.tsx`**
   - Removed `StorageVicinitySelector` import
   - Removed `areaDataSource` prop (was: `'parent_structures' | 'storage_vicinities'`)
   - Removed `showLegacyField`, `legacyLocation`, `legacyFieldLabel` props
   - Simplified to only support `parent_structures`
   - Removed conditional rendering logic for legacy fields

### Forms
2. **`src/components/tools/forms/AddToolForm.tsx`**
   - Removed `legacy_storage_vicinity: "General"` from tool creation
   - Removed `areaDataSource="parent_structures"` prop (now default)

3. **`src/components/tools/forms/EditToolForm.tsx`**
   - Removed `legacyLocation`, `showLegacyField` props from LocationFieldsGroup
   - Removed `areaDataSource` prop

4. **`src/components/InventoryItemForm.tsx`**
   - Removed `legacyLocation`, `showLegacyField`, `legacyFieldLabel` props
   - Removed `areaDataSource` prop

5. **`src/components/CombinedAssetDialog.tsx`**
   - Removed `areaDataSource` prop from LocationFieldsGroup

### Display Components
6. **`src/components/tools/ToolCard.tsx`**
   - Changed from displaying `tool.legacy_storage_vicinity`
   - Now displays `tool.parent_structure_name` (from parent structure lookup)
   - Only shows location if parent_structure_name or storage_location exists

7. **`src/components/tools/ToolDetails.tsx`**
   - Removed "Legacy Location" field display
   - Changed to show "Area" with `tool.parent_structure_name`
   - Renamed "Storage Location" to "Specific Location" for clarity

## Database Schema
**Note**: Database columns NOT removed to preserve historical data:
- `tools.legacy_storage_vicinity` - Kept for reference
- `parts.legacy_storage_vicinity` - Kept for reference
- `storage_vicinities` table - Kept for historical records

These columns are no longer used by the application but remain for data integrity and historical analysis.

## Architecture Changes

### Before (Dual System)
```typescript
// Two ways to specify location
interface Tool {
  legacy_storage_vicinity?: string;  // Old way (text)
  parent_structure_id?: string;      // New way (UUID)
  storage_location?: string;         // Specific location within area
}

// Component supported both
<LocationFieldsGroup
  areaDataSource="parent_structures" | "storage_vicinities"
  showLegacyField={true}
  legacyLocation="General"
/>
```

### After (Single System)
```typescript
// One way to specify location
interface Tool {
  parent_structure_id?: string;      // UUID reference to parent structure
  storage_location?: string;         // Specific location within area
  parent_structure_name?: string;    // Resolved name (from JOIN)
}

// Component only supports parent structures
<LocationFieldsGroup
  areaValue={parent_structure_id}
  specificLocation={storage_location}
/>
```

## Benefits

### Code Simplification
- **Removed**: 250+ lines of legacy code
- **Simplified**: LocationFieldsGroup from 100+ lines to ~60 lines
- **Eliminated**: Conditional logic for dual-system support

### Improved Maintainability
- Single source of truth for locations
- No confusion between legacy and new systems
- Clearer component APIs (fewer props)
- Easier onboarding for new developers

### Better UX
- Consistent location display across all views
- Parent structures can be renamed without data migration
- Vehicles can now be parent structures (e.g., tire gauge in Honda XR 150)
- Hierarchical organization (tools → containers → infrastructure)

## Migration Details

### Mappings Applied
- **Storage Shed** (365 tools) - Already mapped
- **Guest House** (201 tools) - Includes Kitchen variants
- **Compost Building** (12 tools) - Composter Area + Workshop
- **SF072125BO01** (8 tools) - Computer Bin variants
- **Farm** (2 tools) - Infrastructure structures
- **Farm Entrance** (1 tool) - Honda XR 150
- **Honda XR 150** (1 tool) - Tire Pressure Gauge (vehicle as parent!)
- **Storage Shed** (11 tools) - General farm tools

### Intentionally Unmapped
- SF071925TB01 toolbox (5 tools) - Tools belong in toolbox
- ATI Learning Site, Repair Box, Toilet, etc. (8 tools) - Need review

## Testing Checklist
- [x] Build succeeds without errors
- [ ] Tool creation works (no legacy_storage_vicinity sent)
- [ ] Tool editing works (legacy fields not shown)
- [ ] Tool display shows parent_structure_name correctly
- [ ] Inventory item forms work
- [ ] Combined asset dialog works
- [ ] Location fields render correctly in all forms

## Rollback Plan
If issues arise:
1. Git revert this commit
2. Restore StorageVicinitySelector.tsx from git history
3. Restore LocationFieldsGroup.tsx from git history
4. Restore form components from git history

## Future Cleanup
Consider removing in future:
- Database columns: `legacy_storage_vicinity` (after 1 year retention)
- Database table: `storage_vicinities` (after archival)
- Any remaining references in backend APIs
