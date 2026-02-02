# Frontend Migration to Analysis Endpoints

## Summary

Updated all frontend hooks to use the new `/api/analysis/*` endpoints instead of the deprecated `/api/action_scores` endpoint.

## Changes Made

### 1. **useActionScores.tsx**
- Updated `ActionScore` interface to match new schema:
  - `scores`: Changed from `Record<string, {score, reason}>` to `Array<{score_name, score, reason, how_to_improve}>`
  - Added `attributes` and `contexts` arrays
  - Removed deprecated fields: `source_type`, `source_id`, `prompt_text`, `likely_root_causes`, `asset_context_id`, `asset_context_name`
- Updated endpoints:
  - `GET /action_scores?source_id=X&source_type=action` → `GET /analysis/analyses?context_service=action_score&context_id=X`
  - `POST /action_scores` → `POST /analysis/analyses`
- Disabled `updateScore` (not implemented in new schema)

### 2. **usePersonalActionScores.tsx**
- Updated to fetch from `/analysis/analyses` with user_id filter
- Changed score aggregation to work with array format instead of object format

### 3. **useAssetScores.tsx**
- Updated `AssetScore` interface to match new schema
- Updated endpoints to use `/analysis/analyses` with context filters
- Changed `context_service` based on source_type:
  - `action` → `action_score`
  - `issue` → `issue_score`
- Removed placeholder action creation logic (no longer needed)

### 4. **useScoredActions.tsx**
- Updated `ScoredAction` and `RawActionScore` interfaces
- Modified data mapping to extract `action_id` from `contexts` array
- Updated to work with new array-based scores format

### 5. **queryFetchers.ts**
- Changed `fetchActionScores` to call `/analysis/analyses` instead of `/action_scores`

## Data Structure Changes

### Old Format (action_scores)
```typescript
{
  id: string;
  action_id: string;
  source_type: 'action';
  source_id: string;
  prompt_text: string;
  scores: {
    quality: { score: 2, reason: "..." },
    efficiency: { score: -1, reason: "..." }
  };
  likely_root_causes: string[];
  asset_context_id: string;
}
```

### New Format (analyses)
```typescript
{
  id: string;
  prompt_id: string;
  scores: [
    { score_name: "quality", score: 2, reason: "...", how_to_improve: "..." },
    { score_name: "efficiency", score: -1, reason: "..." }
  ];
  attributes: [
    { attribute_name: "likely_root_cause", attribute_values: ["..."] }
  ];
  contexts: [
    { context_service: "action_score", context_id: "action-uuid" }
  ];
}
```

## Breaking Changes

1. **Score format**: Changed from object to array
2. **Context linking**: Now uses `contexts` array instead of direct foreign keys
3. **Attributes**: Moved to separate `attributes` array
4. **Update operations**: Not yet implemented in new schema

## Testing Checklist

- [ ] Action detail page loads scores correctly
- [ ] Personal dashboard aggregates scores properly
- [ ] Asset scores display correctly
- [ ] Scored actions list works with filters
- [ ] Creating new scores works
- [ ] Date range filtering works
- [ ] User filtering works

## Notes

- The `updateScore` function is disabled in both `useActionScores` and `useAssetScores` as the new schema doesn't support updates yet
- Query keys remain unchanged (`action_scores`) to maintain cache compatibility
- All endpoints now use `/api/analysis/*` prefix
