# Migration: Use organization_members Instead of profiles

## Overview
We are migrating from using the `/profiles` endpoint to `/organization_members` for fetching user data in action dialogs and related components. This provides better organization filtering and eliminates data duplication issues.

## Why Migrate?

1. **Better Organization Filtering**: `/organization_members` already filters by the current organization and active status
2. **Eliminates Data Issues**: The `/profiles` endpoint had issues with:
   - Showing users from all organizations when user has `data_read_all` permission
   - Including users with empty/whitespace names
   - Inconsistent filtering behavior
3. **Single Source of Truth**: `organization_members` is the authoritative source for organization-scoped user data

## Migration Pattern

### Before (using profiles):
```tsx
import { useActionProfiles } from "@/hooks/useActionProfiles";

const { profiles } = useActionProfiles();
```

### After (using organization_members):
```tsx
import { useOrganizationMembers } from "@/hooks/useOrganizationMembers";

const { members: organizationMembers } = useOrganizationMembers();

// Transform to Profile format if needed
const profiles = organizationMembers
  .filter(member => member.full_name && member.full_name.trim() !== '')
  .map(member => ({
    id: member.user_id,
    user_id: member.user_id,
    full_name: member.full_name,
    role: member.role
  }));
```

## Completed Migrations

✅ **Issue-related components** (2024):
- `src/components/IssueCard.tsx`
- `src/components/GenericIssueCard.tsx`
- `src/components/ManageIssueActionsDialog.tsx`

## Pending Migrations

The following components still use `useActionProfiles` and should be migrated:

- `src/pages/Actions.tsx`
- `src/pages/Missions.tsx`
- `src/pages/EditMission.tsx`
- `src/components/SimpleMissionForm.tsx`
- `src/components/tools/forms/EditToolForm.tsx`
- `src/components/InventoryItemForm.tsx`

## Notes

- The `Profile` interface expects: `id`, `user_id`, `full_name`, `role`
- `OrganizationMember` already has these fields, just needs transformation
- The filter for empty names is important - `/organization_members` endpoint should handle this, but we add client-side filtering as a safety measure
- `favorite_color` is available in `OrganizationMember` but not in the `Profile` interface used by `UnifiedActionDialog` - this is fine for now

## Benefits

- ✅ Proper organization filtering (only shows members from current org)
- ✅ Only active members are shown
- ✅ Empty/whitespace names are filtered out
- ✅ Consistent behavior across all components
- ✅ Single source of truth for organization member data

