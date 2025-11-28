# Testing Action Scores Data Access

## ✅ Completed

1. **Updated Lambda Function** - Deployed with enhanced action_scores endpoints
2. **Updated Frontend Hook** - `useActionScores.tsx` now uses API service
3. **Created Test Page** - `/test-action-scores` route for data verification

## 🧪 How to Test

### Step 1: Start the Frontend
```bash
npm run dev
```

### Step 2: Navigate to Test Page
1. Login to the application
2. Go to: `http://localhost:8080/test-action-scores`
3. Click "Run API Tests"

### Step 3: Review Results

The test will check:
- ✅ Total action scores in database
- ✅ Actions with assigned users
- ✅ Organization members
- ✅ User ID format (Cognito vs Supabase)
- ✅ Current user's action scores

## 📊 Expected Results

### Scenario 1: No Action Scores Yet
```json
{
  "actionScores": { "count": 0 },
  "actions": { "withUsers": 5, "completed": 2 },
  "userIdFormat": { "cognito": 4, "supabase": 0, "needsMigration": false }
}
```
**Action**: Action scores need to be created via ActionScoreDialog

### Scenario 2: Has Action Scores (Cognito IDs)
```json
{
  "actionScores": { "count": 10 },
  "userIdFormat": { "cognito": 4, "supabase": 0, "needsMigration": false },
  "currentUserScores": { "count": 3 }
}
```
**Action**: ✅ Ready to build radar chart

### Scenario 3: Has Action Scores (Supabase IDs)
```json
{
  "actionScores": { "count": 10 },
  "userIdFormat": { "cognito": 0, "supabase": 4, "needsMigration": true }
}
```
**Action**: ⚠️ Need to run user ID migration script

## 🔧 API Endpoints Available

### GET /api/action_scores
- Query params: `user_id`, `start_date`, `end_date`
- Returns: Array of action scores with joined action data

### POST /api/action_scores
- Body: ActionScore object
- Returns: Created score

### PUT /api/action_scores/{id}
- Body: Partial updates
- Returns: Updated score

## 📋 Next Steps Based on Results

### If No Action Scores:
1. Create some action scores using ActionScoreDialog
2. Complete some actions and score them
3. Re-run test to verify data

### If User IDs Need Migration:
1. Run migration script (see README.md for mapping)
2. Update actions.assigned_to to use Cognito IDs
3. Re-run test to verify

### If Data Looks Good:
1. ✅ Proceed to create PersonalActionScoresRadar component
2. ✅ Integrate into Worker page
3. ✅ Build radar chart visualization

## 🐛 Troubleshooting

### "Unauthorized" Error
- Check that you're logged in
- Verify Cognito token is valid
- Check Lambda authorizer logs

### "No data" Results
- Verify database has action_scores table
- Check if actions have assigned_to values
- Verify organization_members table has users

### API Errors
- Check Lambda logs: `aws logs tail /aws/lambda/cwf-core-lambda --follow`
- Verify RDS connection
- Check API Gateway configuration
