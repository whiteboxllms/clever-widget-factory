# Storage Vicinity to Parent Structure Mapping

## Overview
This document maps legacy `storage_vicinities` to new `parent_structure_id` (Infrastructure/Container tools).

## Mapping Strategy
- **One-to-Many**: Multiple legacy vicinity names can map to the same structure
- **Case/Spacing Variants**: Treat as same location (e.g., "Kitchen", "Kitchen ", "Kitchen measurement" → "Kitchen")
- **Aliases**: Map known aliases to canonical names (e.g., "Composter Area" → "Workshop")

## Complete Mapping

### Auto-Matched (Already Exist)
| Legacy Vicinity | Parent Structure | Tool Count | Status |
|----------------|------------------|------------|--------|
| Storage Shed | Storage Shed | 365 | ✅ Matched |
| Guest House | Guest House | 100 | ✅ Matched |
| Guest house | Guest House | 86 | ✅ Matched |
| Guest house  | Guest House | 2 | ✅ Matched |

### Needs Structure Creation

#### High Priority (>10 tools)
| Legacy Vicinity | New Structure | Tool Count | Notes |
|----------------|---------------|------------|-------|
| General | General Storage | 202 | Catch-all for misc items |

#### Medium Priority (2-10 tools)
| Legacy Vicinity | New Structure | Tool Count | Notes |
|----------------|---------------|------------|-------|
| Composter Area | Compost Building | 10 | |
| Composter area  | Compost Building | 1 | Spacing variant |
| Guesthouse  | Guest House | 8 | Spacing variant of existing |
| Kitchen | Guest House | 1 | Map to existing structure |
| Kitchen  | Guest House | 2 | Spacing variant |
| Kitchen measurement | Guest House | 1 | Same location |
| Computer Bin | SF072125BO01 | 4 | Map to existing structure |
| Computer bin | SF072125BO01 | 3 | Case variant |
| SF072125BO01 | SF072125BO01 | 1 | Already exists |

#### Low Priority (1 tool each)
| Legacy Vicinity | New Structure | Tool Count | Notes |
|----------------|---------------|------------|-------|
| Workshop | Workshop | 1 | |
| Motorcycle Shed | Motorcycle Shed | 2 | |
| ATI Learning Site | ATI Learning Site | 1 | |
| Repair Box | Repair Box | 1 | |
| Toilet  | Toilet | 1 | |
| Guest hoise | Guest House | 1 | Typo variant |

### Skip (Data Entry Errors or Special Cases)
| Legacy Vicinity | Reason | Tool Count |
|----------------|--------|------------|
| SF071925TB01 | Serial number, not location | 5 |
| SF071925TB0I | Serial number, not location | 1 |

| SF072625BO01 | Serial number, not location | 1 |
| SF072725BO01 | Serial number, not location | 1 |
| Trash | Should mark tools as removed | 1 |
| S1P3 | Unknown code | 1 |

## "General" Vicinity Deep Dive

**202 tools** across multiple categories:
- Hand Tools: 52 (26%)
- Electric Tool: 47 (23%)
- Unknown: 44 (22%)
- Container: 22 (11%)
- Field: 20 (10%)
- Infrastructure: 8 (4%)
- Vehicle: 8 (4%)
- Recreation: 1 (<1%)

**Recommendation**: Create "General Storage" Infrastructure tool as catch-all. Consider future redistribution to specific structures.

## Implementation Steps

1. **Create missing structures** (run `create-missing-structures.sql`)
2. **Get structure IDs** from database
3. **Run migration SQL** to update tools with `parent_structure_id`
4. **Verify migration** (check tool counts match)
5. **Update frontend** to hide legacy vicinity selector
6. **Deprecate** `storage_vicinities` table

## Migration SQL Template

```sql
-- After creating structures, get their IDs and run:

-- General → General Storage
UPDATE tools 
SET parent_structure_id = '<GENERAL_STORAGE_ID>'
WHERE legacy_storage_vicinity = 'General'
  AND parent_structure_id IS NULL;

-- Composter variants → Compost Building
UPDATE tools 
SET parent_structure_id = '<COMPOST_BUILDING_ID>'
WHERE legacy_storage_vicinity IN ('Composter Area', 'Composter area ')
  AND parent_structure_id IS NULL;

-- Workshop → Workshop
UPDATE tools 
SET parent_structure_id = '<WORKSHOP_ID>'
WHERE legacy_storage_vicinity = 'Workshop'
  AND parent_structure_id IS NULL;

-- Computer Bin variants → SF072125BO01 (existing structure)
UPDATE tools 
SET parent_structure_id = '<SF072125BO01_ID>'
WHERE legacy_storage_vicinity IN ('Computer Bin', 'Computer bin', 'SF072125BO01')
  AND parent_structure_id IS NULL;

-- Kitchen and Guesthouse variants → Guest House (existing)
UPDATE tools 
SET parent_structure_id = '<GUEST_HOUSE_ID>'
WHERE legacy_storage_vicinity IN ('Guesthouse ', 'Guest hoise')
  AND parent_structure_id IS NULL;

-- Continue for remaining structures...
```

## Verification Queries

```sql
-- Check unmapped tools
SELECT legacy_storage_vicinity, COUNT(*) 
FROM tools 
WHERE legacy_storage_vicinity IS NOT NULL 
  AND parent_structure_id IS NULL
GROUP BY legacy_storage_vicinity
ORDER BY COUNT(*) DESC;

-- Check migration success
SELECT 
  COALESCE(legacy_storage_vicinity, 'NULL') as vicinity,
  COALESCE(parent_structure_id::text, 'NULL') as structure_id,
  COUNT(*) as tool_count
FROM tools
GROUP BY legacy_storage_vicinity, parent_structure_id
ORDER BY tool_count DESC;
```
