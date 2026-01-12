# Exploration Code Format Update

## Change
Updated exploration code format to support flexible suffixes instead of requiring "EX".

## New Format
`<FARM><MMDDYY><SUFFIX><NUMBER>`

### Components
- **FARM**: 2-letter farm code (default: "SF")
- **MMDDYY**: Date in mmddyy format
- **SUFFIX**: 2-letter suffix indicating exploration type
- **NUMBER**: 2+ digit auto-incrementing number

### Examples
- `SF010126EX01` - Standard exploration on Jan 1, 2026
- `SF122925CT01` - Curry tree exploration on Dec 29, 2025
- `SF010126CT02` - Second curry tree exploration on Jan 1, 2026

## Suffix Options
The suffix can be any 2-letter code:
- **EX** - General exploration (default)
- **CT** - Curry tree
- **MG** - Mango
- **PP** - Papaya
- etc.

## Usage

### TypeScript/Frontend
```typescript
import { explorationCodeGenerator } from './services/explorationCodeGenerator';

// Default (EX suffix)
const code1 = await explorationCodeGenerator.generateCode(new Date());
// Result: SF010126EX01

// Custom suffix
const code2 = await explorationCodeGenerator.generateCode(new Date(), { suffix: 'CT' });
// Result: SF010126CT01

// User override
const code3 = await explorationCodeGenerator.generateCode(new Date(), { 
  userOverride: 'SF122925CT05' 
});
// Result: SF122925CT05 (if unique)
```

### Validation
```typescript
// Validate format
ExplorationCodeGenerator.validateCodeFormat('SF010126CT01'); // true
ExplorationCodeGenerator.validateCodeFormat('SF010126EX1');  // false (needs 2+ digits)

// Parse code
const parsed = ExplorationCodeGenerator.parseCode('SF122925CT01');
// Result: {
//   farmCode: 'SF',
//   date: Date(2025-12-29),
//   suffix: 'CT',
//   number: 1
// }
```

## Auto-Increment Behavior
The auto-increment is scoped to the combination of date + suffix:
- `SF010126EX01`, `SF010126EX02` - Separate sequence for EX
- `SF010126CT01`, `SF010126CT02` - Separate sequence for CT

This allows multiple exploration types on the same date without conflicts.

## Database
No database changes required. The `exploration_code` field already stores text and has a unique constraint.

## API Endpoints
Existing endpoints work without changes:
- `GET /api/explorations/check-code/{code}` - Validates any format
- `GET /api/explorations/codes-by-prefix/{prefix}` - Returns matching codes

## Backward Compatibility
✅ All existing codes with "EX" suffix continue to work
✅ Default behavior unchanged (uses "EX" if no suffix specified)
✅ No migration needed
