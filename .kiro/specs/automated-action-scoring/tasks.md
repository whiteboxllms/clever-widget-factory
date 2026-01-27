# Automated Action Scoring - Tasks

## Phase 1: Backend Infrastructure

### 1. Create Shared Scoring Module
- [ ] 1.1 Create `lambda/shared/action-scoring.js`
- [ ] 1.2 Implement `buildScoringPrompt()` function
- [ ] 1.3 Implement `generateScoresWithBedrock()` function
- [ ] 1.4 Implement `parseAndValidateScores()` function
- [ ] 1.5 Add unit tests for all functions

### 2. Create Action Scoring Lambda
- [ ] 2.1 Create `lambda/action-scoring/` directory structure
- [ ] 2.2 Create `lambda/action-scoring/index.js` handler
- [ ] 2.3 Implement action fetching with joins (asset, issue, assignee)
- [ ] 2.4 Implement prompt fetching (default or specified)
- [ ] 2.5 Implement auto-save logic for action_scores table
- [ ] 2.6 Add error handling and logging
- [ ] 2.7 Create `lambda/action-scoring/index.test.js`
- [ ] 2.8 Add integration tests

### 3. Deploy Lambda and API Gateway
- [ ] 3.1 Create `lambda/action-scoring/deploy.sh`
- [ ] 3.2 Create `lambda/action-scoring/wire-api-gateway.sh`
- [ ] 3.3 Deploy Lambda function to AWS
- [ ] 3.4 Wire API Gateway endpoint `/action-scoring/generate`
- [ ] 3.5 Test endpoint with Postman/curl

## Phase 2: Frontend - ActionScoreDialog

### 4. Add Auto-Score Button to ActionScoreDialog
- [ ] 4.1 Add `isAutoScoring` state to ActionScoreDialog
- [ ] 4.2 Add "Auto-Score with AI" button next to "Copy to Clipboard"
- [ ] 4.3 Implement `handleAutoScore()` function
- [ ] 4.4 Add loading state with spinner and "AI is analyzing..." text
- [ ] 4.5 Handle success: populate ScoreEntryForm with parsed scores
- [ ] 4.6 Handle errors: show toast with fallback suggestion
- [ ] 4.7 Test manual auto-scoring flow end-to-end

## Phase 3: Frontend - UnifiedActionDialog

### 5. Add Auto-Scoring to Action Completion
- [ ] 5.1 Create `useActionScoring` hook in `src/hooks/useActionScoring.tsx`
- [ ] 5.2 Add `triggerAutoScoring()` function to UnifiedActionDialog
- [ ] 5.3 Integrate auto-scoring into `handleReadyForReview()`
- [ ] 5.4 Ensure auto-scoring runs in background (non-blocking)
- [ ] 5.5 Add success toast for completed scoring
- [ ] 5.6 Handle errors silently (log only, don't notify user)
- [ ] 5.7 Test completion flow with auto-scoring

## Phase 4: Testing and Validation

### 6. Integration Testing
- [ ] 6.1 Test auto-scoring from "Ready for Review" button
- [ ] 6.2 Test manual auto-scoring from ActionScoreDialog
- [ ] 6.3 Test re-scoring existing actions
- [ ] 6.4 Test with various scoring prompts
- [ ] 6.5 Test error scenarios (Bedrock timeout, invalid response)
- [ ] 6.6 Verify backward compatibility with manual copy-paste flow
- [ ] 6.7 Test on mobile devices

### 7. Production Validation
- [ ] 7.1 Deploy to production
- [ ] 7.2 Test with single real action
- [ ] 7.3 Monitor CloudWatch logs for errors
- [ ] 7.4 Verify scores saved correctly in database
- [ ] 7.5 Check Bedrock API costs
- [ ] 7.6 Gather user feedback

## Phase 5: Documentation and Cleanup

### 8. Documentation
- [ ] 8.1 Update README with auto-scoring feature
- [ ] 8.2 Document Lambda function in `lambda/action-scoring/README.md`
- [ ] 8.3 Add deployment instructions
- [ ] 8.4 Document error codes and troubleshooting

### 9. Monitoring Setup
- [ ] 9.1 Set up CloudWatch alarms for Lambda errors
- [ ] 9.2 Set up CloudWatch alarms for Bedrock errors
- [ ] 9.3 Create dashboard for auto-scoring metrics
- [ ] 9.4 Document monitoring procedures
