# Action Scores Radar Chart Implementation Plan

## Current State Analysis

### Database Structure
- **Table**: `action_scores` exists in RDS
- **Key Fields**:
  - `id`: Primary key
  - `action_id`: Links to actions table
  - `source_type`: 'action'
  - `source_id`: Same as action_id
  - `prompt_id`: AI scoring prompt used
  - `prompt_text`: Full prompt text
  - `scores`: JSONB object with structure: `{attribute_name: {score: number, reason: string}}`
  - `ai_response`: Full AI response
  - `likely_root_causes`: Array of root causes
  - `asset_context_id`: Asset ID
  - `asset_context_name`: Asset name
  - `created_at`, `updated_at`: Timestamps

### Current Implementation
- **Frontend**: Uses Supabase client in `useActionScores.tsx`
- **Backend**: API endpoint `/api/action_scores` exists in Lambda
- **UI**: `ActionScoreDialog.tsx` creates scores per action
- **Data Flow**: Actions → Action Scores (via AI scoring)

### User ID Format
- Actions table has `assigned_to` field with user IDs
- Need to verify if using Cognito IDs or old Supabase UUIDs
- Migration mapping available in README.md

## Implementation Plan

### Phase 1: Data Loading & Migration Check (CURRENT)

**Step 1.1**: Update `useActionScores.tsx` to use API service
- Replace Supabase client with `apiService`
- Update endpoints to use `/api/action_scores`
- Add user_id filtering support

**Step 1.2**: Enhance Lambda endpoint for user filtering
- Add `user_id` query parameter support
- Join with actions table to filter by assigned_to
- Return enriched data with user info

**Step 1.3**: Check and migrate user IDs if needed
- Query action_scores → actions → assigned_to
- Compare with Cognito user IDs
- Create migration script if Supabase UUIDs found

### Phase 2: Create Personal Radar Component

**Step 2.1**: Create `usePersonalActionScores.tsx` hook
```typescript
// Fetch action scores for a specific user
// Aggregate scores by attribute
// Calculate averages across all scored actions
```

**Step 2.2**: Create `PersonalActionScoresRadar.tsx` component
```typescript
// Display radar chart with user's attribute scores
// Use same radar chart library as AttributeRadarChart
// Show 0-4 scale for scores
// Include date range filtering
```

### Phase 3: Integrate into Worker Page

**Step 3.1**: Add radar chart to Worker.tsx
- Place above or below skills overview
- Show personal action scores over time
- Add date range selector

**Step 3.2**: Add comparison view (optional)
- Compare personal scores to team average
- Show improvement over time

### Phase 4: Analytics Dashboard Integration (Optional)

**Step 4.1**: Add action scores tab to AnalyticsDashboard
- Show individual action score details
- Filter by user, date, asset
- Link to specific actions

## Data Structure

### Action Score Object
```typescript
interface ActionScore {
  id: string;
  action_id: string;
  source_type: 'action';
  source_id: string;
  prompt_id: string;
  prompt_text: string;
  scores: Record<string, { score: number; reason: string }>;
  ai_response?: Record<string, any>;
  likely_root_causes?: string[];
  created_at: string;
  updated_at: string;
  asset_context_id?: string;
  asset_context_name?: string;
}
```

### Aggregated User Scores
```typescript
interface UserActionScores {
  userId: string;
  userName: string;
  attributes: Record<string, {
    avgScore: number;
    count: number;
    scores: number[];
  }>;
  totalActions: number;
  dateRange: { start: string; end: string };
}
```

## API Endpoints Needed

### Existing
- `GET /api/action_scores?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

### New (to add to Lambda)
- `GET /api/action_scores?user_id=<cognito_id>&start_date=&end_date=`
- Returns action scores filtered by user's actions

## Migration Check Query
```sql
-- Check if action_scores need user ID migration
SELECT 
  a.assigned_to,
  COUNT(*) as score_count,
  MIN(s.created_at) as earliest_score
FROM action_scores s
JOIN actions a ON a.id = s.action_id
WHERE a.assigned_to IS NOT NULL
GROUP BY a.assigned_to;

-- Compare with Cognito IDs
SELECT 
  om.user_id as cognito_id,
  om.full_name,
  COUNT(s.id) as score_count
FROM organization_members om
LEFT JOIN actions a ON a.assigned_to = om.user_id
LEFT JOIN action_scores s ON s.action_id = a.id
GROUP BY om.user_id, om.full_name;
```

## Next Steps

1. ✅ Load action_scores data to verify structure
2. ⏳ Check user ID format (Cognito vs Supabase)
3. ⏳ Update useActionScores.tsx to use API service
4. ⏳ Enhance Lambda endpoint for user filtering
5. ⏳ Create PersonalActionScoresRadar component
6. ⏳ Integrate into Worker page

## Files to Create
- `/src/hooks/usePersonalActionScores.tsx`
- `/src/components/PersonalActionScoresRadar.tsx`

## Files to Modify
- `/src/hooks/useActionScores.tsx` - Replace Supabase with API service
- `/src/pages/Worker.tsx` - Add radar chart
- `/lambda/core/index.js` - Add user_id filtering to action_scores endpoint
