# GUI Validation Fix for Flexible Exploration Codes

## Issue
After updating the backend to support flexible suffixes (e.g., `SF122925CT01`), the GUI validation was still rejecting codes that didn't have "EX" as the suffix.

Error message shown:
```
Invalid format. Expected: SF<mmddyy>EX<number>
```

## Root Cause
The frontend validation regex in `UnifiedActionDialog.tsx` was hardcoded to require "EX":
```typescript
const formatRegex = /^SF\d{6}EX\d{2,}$/;  // ❌ Only accepts EX
```

## Fix Applied

### 1. Updated Validation Regex
**File:** `src/components/UnifiedActionDialog.tsx`

Changed from:
```typescript
const formatRegex = /^SF\d{6}EX\d{2,}$/;
```

To:
```typescript
const formatRegex = /^[A-Z]{2}\d{6}[A-Z]{2}\d{2,}$/;
```

This now accepts:
- Any 2-letter farm code (not just "SF")
- Any 2-letter suffix (not just "EX")
- 2 or more digits for the number

### 2. Updated Error Message
Changed from:
```
Invalid format. Expected: SF<mmddyy>EX<number>
```

To:
```
Invalid format. Expected: SF<mmddyy><SUFFIX><number> (e.g., SF010126EX01 or SF122925CT01)
```

### 3. Updated Help Text
Changed from:
```
Format: SF<mmddyy>EX<number> (auto-generated, editable)
```

To:
```
Format: SF<mmddyy><SUFFIX><number> (e.g., SF010126EX01, SF122925CT01)
```

### 4. Updated Tests
- `src/tests/exploration-data-collection/exploration-code-auto-generation.test.ts`
- `src/tests/exploration-data-collection/action-creation-form.test.ts`

## Valid Examples
✅ `SF010126EX01` - Standard exploration
✅ `SF122925CT01` - Curry tree
✅ `SF010126MG01` - Mango
✅ `AB123456XY99` - Any farm code, any suffix

## Invalid Examples
❌ `SF010126E01` - Suffix must be 2 letters
❌ `SF010126EX1` - Number must be 2+ digits
❌ `S010126EX01` - Farm code must be 2 letters
❌ `SF01012EX01` - Date must be 6 digits

## Testing
The validation now matches the backend implementation in `ExplorationCodeGenerator.validateCodeFormat()`:
```typescript
const pattern = /^[A-Z]{2}\d{6}[A-Z]{2}\d{2,}$/;
```

Both frontend and backend use the same regex pattern for consistency.
