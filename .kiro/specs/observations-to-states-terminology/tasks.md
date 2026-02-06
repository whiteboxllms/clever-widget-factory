# Implementation Tasks: Database State Terminology Migration

## Overview

This task list implements the migration from "observation" to "state" terminology in the database and Lambda layer. Tasks are organized by phase for sequential execution.

## Phase 1: Database Migration

### Task 1.1: Create Migration Script
**Priority**: High  
**Estimated Time**: 30 minutes  
**Dependencies**: None

**Description**: Create the SQL migration script to rename tables, columns, indexes, and update comments.

**Acceptance Criteria**:
- [ ] File created: `migrations/002-rename-observations-to-states.sql`
- [ ] Script includes all ALTER TABLE statements
- [ ] Script includes data integrity verification
- [ ] Script wrapped in BEGIN/COMMIT transaction
- [ ] Script includes RAISE NOTICE for counts
- [ ] Script includes error handling

**Implementation Notes**:
- Copy SQL from design.md
- Test on local database first
- Ensure transaction can rollback on error

---

### Task 1.2: Create Rollback Script
**Priority**: High  
**Estimated Time**: 15 minutes  
**Dependencies**: Task 1.1

**Description**: Create rollback script to revert migration if needed.

**Acceptance Criteria**:
- [ ] File created: `migrations/002-rollback-rename-observations-to-states.sql`
- [ ] Script reverses all table renames
- [ ] Script reverses all column renames
- [ ] Script reverses all index renames
- [ ] Script wrapped in BEGIN/COMMIT transaction

**Implementation Notes**:
- Copy rollback SQL from design.md
- Keep for emergency use

---

### Task 1.3: Backup Production Database
**Priority**: Critical  
**Estimated Time**: 10 minutes  
**Dependencies**: None

**Description**: Create full database backup before running migration.

**Acceptance Criteria**:
- [ ] Backup file created: `backups/backup-before-states-migration-YYYYMMDD.sql`
- [ ] Backup includes all tables and data
- [ ] Backup file size verified (should be > 10MB)
- [ ] Backup stored in safe location

**Commands**:
```bash
pg_dump -h RDS_HOST -U postgres -d cwf > backups/backup-before-states-migration-$(date +%Y%m%d).sql
```

---

### Task 1.4: Run Migration on Production
**Priority**: Critical  
**Estimated Time**: 5 minutes  
**Dependencies**: Tasks 1.1, 1.2, 1.3

**Description**: Execute migration script via Lambda on production database.

**Acceptance Criteria**:
- [ ] Migration executed successfully
- [ ] Response shows success message
- [ ] Response shows record counts (states, photos, links)
- [ ] No errors in response

**Commands**:
```bash
cat migrations/002-rename-observations-to-states.sql | jq -Rs '{sql: .}' | \
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload file:///dev/stdin \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

---

### Task 1.5: Verify Database Migration
**Priority**: Critical  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 1.4

**Description**: Run verification queries to ensure migration succeeded.

**Acceptance Criteria**:
- [ ] Tables exist: states, state_photos, state_links
- [ ] Old tables do NOT exist: observations, observation_photos, observation_links
- [ ] Column names correct: state_text, captured_by, captured_at
- [ ] Indexes renamed correctly
- [ ] Data counts match pre-migration (20 states expected)
- [ ] Foreign keys work (JOIN queries succeed)

**Commands**:
```bash
# Verify table names
echo '{"sql": "SELECT table_name FROM information_schema.tables WHERE table_name IN ('\''states'\'', '\''state_photos'\'', '\''state_links'\'');"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq -r '.body' | jq

# Verify column names
echo '{"sql": "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '\''states'\'' ORDER BY ordinal_position;"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq -r '.body' | jq

# Verify data counts
echo '{"sql": "SELECT (SELECT COUNT(*) FROM states) as state_count, (SELECT COUNT(*) FROM state_photos) as photo_count, (SELECT COUNT(*) FROM state_links) as link_count;"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq -r '.body' | jq
```

---

## Phase 2: Lambda Function

### Task 2.1: Copy Lambda Directory
**Priority**: High  
**Estimated Time**: 5 minutes  
**Dependencies**: None

**Description**: Copy observations Lambda to states directory.

**Acceptance Criteria**:
- [ ] Directory created: `lambda/states/`
- [ ] File copied: `lambda/states/index.js`
- [ ] File copied: `lambda/states/package.json` (if exists)
- [ ] Original `lambda/observations/` preserved

**Commands**:
```bash
cp -r lambda/observations lambda/states
```

---

### Task 2.2: Update Lambda Code - Table Names
**Priority**: High  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 2.1

**Description**: Update all SQL queries to use new table names.

**Acceptance Criteria**:
- [ ] All `observations` → `states` in SQL queries
- [ ] All `observation_photos` → `state_photos` in SQL queries
- [ ] All `observation_links` → `state_links` in SQL queries
- [ ] All queries tested locally

**Files to Update**:
- `lambda/states/index.js`

**Search and Replace**:
- `FROM observations` → `FROM states`
- `JOIN observation_photos` → `JOIN state_photos`
- `JOIN observation_links` → `JOIN state_links`
- `INSERT INTO observations` → `INSERT INTO states`
- `UPDATE observations` → `UPDATE states`
- `DELETE FROM observations` → `DELETE FROM states`

---

### Task 2.3: Update Lambda Code - Column Names
**Priority**: High  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 2.2

**Description**: Update all SQL queries to use new column names.

**Acceptance Criteria**:
- [ ] All `observation_text` → `state_text` in SQL
- [ ] All `observation_id` → `state_id` in SQL
- [ ] All `observed_by` → `captured_by` in SQL
- [ ] All `observed_at` → `captured_at` in SQL
- [ ] All queries tested locally

**Files to Update**:
- `lambda/states/index.js`

**Search and Replace**:
- `observation_text` → `state_text`
- `observation_id` → `state_id`
- `observed_by` → `captured_by`
- `observed_at` → `captured_at`
- `observed_by_name` → `captured_by_name` (in SELECT aliases)

---

### Task 2.4: Update Lambda Code - Variable Names
**Priority**: Medium  
**Estimated Time**: 15 minutes  
**Dependencies**: Task 2.3

**Description**: Update JavaScript variable names for consistency.

**Acceptance Criteria**:
- [ ] Variable `observation` → `state` where appropriate
- [ ] Variable `obs` → `state` where appropriate
- [ ] Function names updated if needed
- [ ] Code still readable and consistent

**Files to Update**:
- `lambda/states/index.js`

**Examples**:
```javascript
// OLD
const observation = obsResult.rows[0];
return await getObservation(observation.id, authContext, headers);

// NEW
const state = stateResult.rows[0];
return await getState(state.id, authContext, headers);
```

---

### Task 2.5: Update Lambda Code - Error Messages
**Priority**: Low  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 2.4

**Description**: Update error messages to use "state" terminology.

**Acceptance Criteria**:
- [ ] "Observation not found" → "State not found"
- [ ] "Failed to create observation" → "Failed to create state"
- [ ] "Failed to update observation" → "Failed to update state"
- [ ] "Observation deleted" → "State deleted"

**Files to Update**:
- `lambda/states/index.js`

---

### Task 2.6: Create Lambda Deployment Package
**Priority**: High  
**Estimated Time**: 5 minutes  
**Dependencies**: Tasks 2.2, 2.3, 2.4, 2.5

**Description**: Create ZIP file for Lambda deployment.

**Acceptance Criteria**:
- [ ] ZIP file created: `lambda/cwf-states-lambda.zip`
- [ ] ZIP includes index.js
- [ ] ZIP includes package.json (if exists)
- [ ] ZIP includes node_modules (if exists)

**Commands**:
```bash
cd lambda/states
zip -r ../cwf-states-lambda.zip .
cd ../..
```

---

### Task 2.7: Deploy Lambda Function
**Priority**: High  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 2.6, Phase 1 complete

**Description**: Deploy new cwf-states-lambda function to AWS.

**Acceptance Criteria**:
- [ ] Lambda function created: `cwf-states-lambda`
- [ ] Function uses Node.js 18.x runtime
- [ ] Function has correct IAM role
- [ ] Function has 30s timeout
- [ ] Function has 512MB memory
- [ ] Function deployed to us-west-2

**Commands**:
```bash
aws lambda create-function \
  --function-name cwf-states-lambda \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambda/cwf-states-lambda.zip \
  --timeout 30 \
  --memory-size 512 \
  --region us-west-2
```

**Note**: If function already exists, use `update-function-code` instead:
```bash
aws lambda update-function-code \
  --function-name cwf-states-lambda \
  --zip-file fileb://lambda/cwf-states-lambda.zip \
  --region us-west-2
```

---

### Task 2.8: Test Lambda Function
**Priority**: Critical  
**Estimated Time**: 15 minutes  
**Dependencies**: Task 2.7

**Description**: Test Lambda function with sample requests.

**Acceptance Criteria**:
- [ ] GET /states returns 200
- [ ] GET /states returns array of states
- [ ] GET /states/{id} returns 200
- [ ] GET /states/{id} returns single state
- [ ] POST /states creates new state
- [ ] PUT /states/{id} updates state
- [ ] DELETE /states/{id} deletes state
- [ ] All responses use new field names (state_text, captured_by, captured_at)

**Commands**:
```bash
# Test GET /states
aws lambda invoke \
  --function-name cwf-states-lambda \
  --payload '{"httpMethod":"GET","path":"/states","headers":{"Authorization":"Bearer TOKEN"},"requestContext":{"authorizer":{"organization_id":"ORG_ID","user_id":"USER_ID"}}}' \
  --region us-west-2 \
  response.json && cat response.json | jq
```

---

## Phase 3: API Gateway

### Task 3.1: Create /states Resource
**Priority**: High  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 2.7

**Description**: Create /states resource in API Gateway.

**Acceptance Criteria**:
- [ ] Resource created: /states
- [ ] Resource ID captured for next steps

**Commands**:
```bash
API_ID=0720au267k
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region us-west-2 --query 'items[?path==`/`].id' --output text)

STATES_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part states \
  --region us-west-2 \
  --query 'id' --output text)

echo "STATES_ID=$STATES_ID"
```

---

### Task 3.2: Create /states/{id} Resource
**Priority**: High  
**Estimated Time**: 5 minutes  
**Dependencies**: Task 3.1

**Description**: Create /states/{id} resource in API Gateway.

**Acceptance Criteria**:
- [ ] Resource created: /states/{id}
- [ ] Resource ID captured for next steps

**Commands**:
```bash
STATES_ID_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $STATES_ID \
  --path-part '{id}' \
  --region us-west-2 \
  --query 'id' --output text)

echo "STATES_ID_RESOURCE=$STATES_ID_RESOURCE"
```

---

### Task 3.3: Configure /states GET Method
**Priority**: High  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 3.1

**Description**: Add GET method to /states resource.

**Acceptance Criteria**:
- [ ] GET method added to /states
- [ ] Method uses custom authorizer
- [ ] Integration points to cwf-states-lambda
- [ ] Integration type is AWS_PROXY

**Commands**:
```bash
# Add method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $STATES_ID \
  --http-method GET \
  --authorization-type CUSTOM \
  --authorizer-id AUTHORIZER_ID \
  --region us-west-2

# Add integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $STATES_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:ACCOUNT:function:cwf-states-lambda/invocations \
  --region us-west-2
```

---

### Task 3.4: Configure /states POST Method
**Priority**: High  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 3.1

**Description**: Add POST method to /states resource.

**Acceptance Criteria**:
- [ ] POST method added to /states
- [ ] Method uses custom authorizer
- [ ] Integration points to cwf-states-lambda

**Commands**: (Similar to Task 3.3, change GET to POST)

---

### Task 3.5: Configure /states/{id} Methods
**Priority**: High  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 3.2

**Description**: Add GET, PUT, DELETE methods to /states/{id} resource.

**Acceptance Criteria**:
- [ ] GET method added to /states/{id}
- [ ] PUT method added to /states/{id}
- [ ] DELETE method added to /states/{id}
- [ ] All methods use custom authorizer
- [ ] All integrations point to cwf-states-lambda

**Commands**: (Similar to Task 3.3, repeat for each method)

---

### Task 3.6: Configure CORS for /states
**Priority**: High  
**Estimated Time**: 15 minutes  
**Dependencies**: Tasks 3.3, 3.4, 3.5

**Description**: Add OPTIONS method and CORS headers to /states endpoints.

**Acceptance Criteria**:
- [ ] OPTIONS method added to /states
- [ ] OPTIONS method added to /states/{id}
- [ ] CORS headers configured
- [ ] Preflight requests work

**Commands**:
```bash
# Add OPTIONS method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $STATES_ID \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region us-west-2

# Add mock integration for OPTIONS
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $STATES_ID \
  --http-method OPTIONS \
  --type MOCK \
  --region us-west-2
```

---

### Task 3.7: Deploy API Gateway
**Priority**: Critical  
**Estimated Time**: 5 minutes  
**Dependencies**: Tasks 3.3, 3.4, 3.5, 3.6

**Description**: Deploy API Gateway changes to prod stage.

**Acceptance Criteria**:
- [ ] Deployment created successfully
- [ ] Deployment ID captured
- [ ] Changes live in prod stage

**Commands**:
```bash
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Add /states endpoints for state terminology migration" \
  --region us-west-2
```

---

### Task 3.8: Update /observations to Use New Lambda
**Priority**: High  
**Estimated Time**: 15 minutes  
**Dependencies**: Task 3.7

**Description**: Point /observations endpoints to cwf-states-lambda for backward compatibility.

**Acceptance Criteria**:
- [ ] /observations GET integration updated
- [ ] /observations POST integration updated
- [ ] /observations/{id} GET integration updated
- [ ] /observations/{id} PUT integration updated
- [ ] /observations/{id} DELETE integration updated
- [ ] API Gateway redeployed

**Commands**:
```bash
# Get /observations resource ID
OBSERVATIONS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --region us-west-2 --query 'items[?path==`/observations`].id' --output text)

# Update GET integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $OBSERVATIONS_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-west-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-west-2:ACCOUNT:function:cwf-states-lambda/invocations \
  --region us-west-2

# Redeploy
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --description "Point /observations to cwf-states-lambda" \
  --region us-west-2
```

---

## Phase 4: Testing & Verification

### Task 4.1: Test /states Endpoints
**Priority**: Critical  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 3.7

**Description**: Test all /states endpoints via API Gateway.

**Acceptance Criteria**:
- [ ] GET /states returns 200
- [ ] GET /states returns array with state_text, captured_by, captured_at fields
- [ ] POST /states creates new state
- [ ] GET /states/{id} returns single state
- [ ] PUT /states/{id} updates state
- [ ] DELETE /states/{id} deletes state
- [ ] All responses have correct CORS headers

**Commands**:
```bash
# Test GET /states
curl -X GET https://API_URL/api/states \
  -H "Authorization: Bearer TOKEN" \
  -v

# Test POST /states
curl -X POST https://API_URL/api/states \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state_text":"Test state","photos":[],"links":[]}' \
  -v
```

---

### Task 4.2: Test /observations Backward Compatibility
**Priority**: Critical  
**Estimated Time**: 15 minutes  
**Dependencies**: Task 3.8

**Description**: Verify /observations endpoints still work for frontend.

**Acceptance Criteria**:
- [ ] GET /observations returns 200
- [ ] GET /observations returns data (queries states table)
- [ ] POST /observations creates new state
- [ ] Frontend can still call /observations without breaking

**Commands**:
```bash
# Test GET /observations
curl -X GET https://API_URL/api/observations \
  -H "Authorization: Bearer TOKEN" \
  -v
```

---

### Task 4.3: Test Frontend
**Priority**: Critical  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 4.2

**Description**: Manually test frontend to ensure observations feature still works.

**Acceptance Criteria**:
- [ ] Can navigate to observations page
- [ ] Can view existing observations
- [ ] Can create new observation with photos
- [ ] Can edit observation
- [ ] Can delete observation
- [ ] No console errors
- [ ] No 404 errors

**Steps**:
1. Open app in browser
2. Navigate to /add-observation
3. Upload photos
4. Add descriptions
5. Save observation
6. Verify observation appears in list
7. Edit observation
8. Delete observation

---

### Task 4.4: Verify Data Integrity
**Priority**: Critical  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 4.3

**Description**: Verify all data is intact after migration.

**Acceptance Criteria**:
- [ ] All 20 original states still exist
- [ ] All photos still accessible
- [ ] All links still valid
- [ ] New observations created successfully
- [ ] Timestamps preserved correctly

**Commands**:
```bash
# Check data counts
echo '{"sql": "SELECT COUNT(*) FROM states;"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq -r '.body' | jq

# Check recent states
echo '{"sql": "SELECT id, state_text, captured_at FROM states ORDER BY captured_at DESC LIMIT 5;"}' | \
aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out response.json && cat response.json | jq -r '.body' | jq
```

---

## Phase 5: Documentation & Cleanup

### Task 5.1: Update Migration Documentation
**Priority**: Medium  
**Estimated Time**: 15 minutes  
**Dependencies**: Phase 4 complete

**Description**: Document the completed migration.

**Acceptance Criteria**:
- [ ] File updated: `migrations/MIGRATION_STATUS.md`
- [ ] Document includes migration date
- [ ] Document includes record counts before/after
- [ ] Document includes any issues encountered

**Content**:
```markdown
## 2025-02-05: Observations to States Terminology Migration

**Status**: ✅ Complete

**Changes**:
- Renamed tables: observations → states, observation_photos → state_photos, observation_links → state_links
- Renamed columns: observation_text → state_text, observed_by → captured_by, observed_at → captured_at
- Deployed cwf-states-lambda function
- Created /states API endpoints
- Updated /observations to use new Lambda (backward compatibility)

**Data Integrity**:
- States before: 20
- States after: 20
- Photos preserved: Yes
- Links preserved: Yes

**Issues**: None
```

---

### Task 5.2: Update README
**Priority**: Low  
**Estimated Time**: 10 minutes  
**Dependencies**: Task 5.1

**Description**: Update README to reflect new terminology.

**Acceptance Criteria**:
- [ ] README mentions "state capture system"
- [ ] README explains hybrid terminology (backend=state, frontend=observation)
- [ ] README updated with new API endpoints

**Files to Update**:
- `lambda/states/README.md` (create if doesn't exist)
- `docs/OBSERVATIONS_SYSTEM_ROADMAP.md` (add note about terminology)

---

### Task 5.3: Create Rollback Documentation
**Priority**: Medium  
**Estimated Time**: 10 minutes  
**Dependencies**: Phase 4 complete

**Description**: Document rollback procedure in case of future issues.

**Acceptance Criteria**:
- [ ] File created: `docs/ROLLBACK-STATES-MIGRATION.md`
- [ ] Document includes rollback SQL
- [ ] Document includes Lambda rollback steps
- [ ] Document includes API Gateway rollback steps

---

## Summary

**Total Estimated Time**: ~6-7 hours

**Critical Path**:
1. Phase 1: Database Migration (1 hour)
2. Phase 2: Lambda Function (1.5 hours)
3. Phase 3: API Gateway (1.5 hours)
4. Phase 4: Testing (1 hour)
5. Phase 5: Documentation (0.5 hours)

**Risk Mitigation**:
- Database backup before migration
- Rollback scripts prepared
- Gradual deployment (Lambda first, then API Gateway)
- Backward compatibility maintained (/observations still works)
- Comprehensive testing before declaring success

**Success Criteria**:
- ✅ All tasks completed
- ✅ All tests passing
- ✅ Frontend working without changes
- ✅ Zero data loss
- ✅ Zero downtime
