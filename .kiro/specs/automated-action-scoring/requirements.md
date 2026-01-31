# Automated Action Scoring - Requirements

## Overview

Automate the action scoring process by integrating AWS Bedrock (Claude) to generate accountability scores directly within the application, eliminating the manual copy-paste workflow to ChatGPT.

## Current Manual Process (Pain Points)

1. User opens ActionScoreDialog for a completed action
2. User selects a scoring prompt from database
3. System generates prompt with action context
4. **User manually copies prompt to clipboard**
5. **User opens ChatGPT in browser and pastes prompt**
6. **User waits for ChatGPT response**
7. **User copies JSON response from ChatGPT**
8. **User pastes response back into dialog**
9. User clicks "Parse & Review Scores"
10. System shows ScoreEntryForm for review
11. User saves scores to database

**Problem**: Steps 4-8 are manual, time-consuming, and error-prone.

## User Stories

### 1. Automatic Scoring on Action Completion

**As a** farm worker completing an action  
**I want** the system to automatically score my action when I click "Ready for Review"  
**So that** I can quickly complete my work without extra steps

**Acceptance Criteria:**
- 1.1: When user clicks "Ready for Review" button, action is completed immediately (existing behavior preserved)
- 1.2: System automatically triggers scoring using the default scoring prompt
- 1.3: Scoring happens in background and saves directly to database (no user review required)
- 1.4: User sees toast notification: "Action completed and scored successfully"
- 1.5: If scoring fails, action still completes but user sees warning: "Action completed but scoring failed. You can score it manually later."
- 1.6: User can view/edit the auto-generated score later via ActionScoreDialog

### 2. Manual Scoring with AI Assistance

**As a** user reviewing action performance  
**I want** to generate AI scores with one click and review them before saving  
**So that** I can ensure accuracy and make adjustments if needed

**Acceptance Criteria:**
- 2.1: ActionScoreDialog has new "Auto-Score with AI" button next to "Copy to Clipboard"
- 2.2: User selects scoring prompt from dropdown first
- 2.3: When user clicks "Auto-Score with AI", system calls Bedrock with selected prompt
- 2.4: System shows loading state: "AI is analyzing the action..." (2-5 seconds)
- 2.5: System displays parsed scores in ScoreEntryForm for review
- 2.6: User can edit scores before saving (existing ScoreEntryForm behavior)
- 2.7: If AI call fails, user sees error and can use manual copy-paste flow as fallback

### 3. Re-scoring Actions

**As a** user who has updated an action  
**I want** to re-score the action with updated information  
**So that** scores reflect the current state of the action

**Acceptance Criteria:**
- 3.1: User can open ActionScoreDialog for any completed action
- 3.2: If action already has a score, dialog shows existing score
- 3.3: User can click "Auto-Score with AI" to generate new score
- 3.4: New score replaces old score (updates existing record)
- 3.5: Score history is preserved via updated_at timestamp

### 4. Backward Compatibility

**As a** user familiar with the current workflow  
**I want** the manual copy-paste flow to remain available  
**So that** I can use it as a fallback or for testing new prompts

**Acceptance Criteria:**
- 4.1: "Copy to Clipboard" button remains in ActionScoreDialog
- 4.2: Manual paste textarea remains available
- 4.3: "Parse & Review Scores" button continues to work
- 4.4: All existing scoring prompts continue to work with both manual and automated flows

## Technical Context

### Existing Infrastructure
- **Scoring Prompts**: Stored in `scoring_prompts` table with versioning
- **Action Scores**: Stored in `action_scores` table with prompt_id, scores, ai_response, likely_root_causes
- **Bedrock Integration**: Already exists in `lambda/shared/ai-summarizer.js` (Claude Haiku)
- **Lambda Handlers**: `/action_scores` and `/scoring_prompts` endpoints in `lambda/core/index.js`

### Prompt Context Generation
Current `generatePrompt()` function in ActionScoreDialog builds context from:
- Action: id, title, description, policy, observations, status, dates, assignee
- Asset: name, category, location, serial_number (if linked)
- Issue: description, type, status, damage_assessment, root_cause (if linked)
- Required tools and stock

### Expected Response Format
Scoring prompts expect JSON response:
```json
{
  "scores": {
    "category_name": {
      "score": 1-10,
      "reason": "explanation"
    }
  },
  "likely_root_causes": ["cause1", "cause2"]
}
```

## Non-Functional Requirements

### Performance
- Auto-scoring should not block action completion
- Bedrock calls should timeout after 10 seconds
- Loading states should be shown for calls > 1 second

### Error Handling
- Failed auto-scoring should not prevent action completion
- Clear error messages for Bedrock failures
- Graceful fallback to manual flow

### Security
- Bedrock calls must use organization-scoped data only
- Scoring prompts must be validated before use
- AI responses must be sanitized before storage

## Out of Scope

- Batch scoring of multiple actions
- Custom AI models (using Claude Haiku only)
- Score analytics or trending
- Notification when auto-scoring completes
- Scoring for non-completed actions

## Success Metrics

- Reduction in time to score an action (from ~2 minutes to ~5 seconds)
- Increase in percentage of actions that get scored
- Zero regressions in existing manual scoring flow
- < 5% failure rate for auto-scoring
