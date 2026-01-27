# Automated Action Scoring - Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  UnifiedActionDialog                ActionScoreDialog        │
│  ┌──────────────────┐              ┌──────────────────┐     │
│  │ Ready for Review │              │ Auto-Score with  │     │
│  │     Button       │              │   AI Button      │     │
│  └────────┬─────────┘              └────────┬─────────┘     │
│           │                                  │               │
│           │ POST /action-scoring/generate    │               │
│           │ (auto_save: true)                │               │
│           │                                  │               │
│           └──────────────┬───────────────────┘               │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│              /action-scoring/generate                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Lambda: cwf-action-scoring                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Fetch action details from RDS                            │
│  2. Fetch scoring prompt from RDS                            │
│  3. Build prompt context (same as ActionScoreDialog)         │
│  4. Call AWS Bedrock (Claude Haiku)                          │
│  5. Parse JSON response                                      │
│  6. If auto_save: Save to action_scores table                │
│  7. Return scores for review                                 │
│                                                               │
└───────────┬───────────────────────────┬─────────────────────┘
            │                           │
            ▼                           ▼
    ┌──────────────┐          ┌──────────────────┐
    │  AWS Bedrock │          │   RDS PostgreSQL │
    │ Claude Haiku │          │  action_scores   │
    └──────────────┘          └──────────────────┘
```

## Component Design

### 1. New Lambda Function: `cwf-action-scoring`

**Location**: `lambda/action-scoring/`

**Purpose**: Generate action scores using AWS Bedrock

**Handler**: `POST /action-scoring/generate`

**Request Body**:
```typescript
{
  action_id: string;
  prompt_id?: string;  // Optional - uses default if not provided
  auto_save?: boolean; // If true, saves directly to DB
}
```

**Response**:
```typescript
{
  success: boolean;
  data?: {
    scores: Record<string, { score: number; reason: string }>;
    likely_root_causes: string[];
    ai_response: Record<string, any>;
    prompt_id: string;
    prompt_text: string;
    asset_context_id?: string;
    asset_context_name?: string;
    saved?: boolean; // true if auto_save was true
  };
  error?: string;
}
```

**Implementation Steps**:
1. Validate request (action_id required, organization_id from authorizer)
2. Fetch action from database with joins (asset, issue, assignee)
3. Fetch scoring prompt (use default if prompt_id not provided)
4. Build prompt context using same logic as ActionScoreDialog.generatePrompt()
5. Call Bedrock with timeout (10 seconds)
6. Parse and validate JSON response
7. If auto_save: Insert/update action_scores table
8. Return scores

**Error Handling**:
- Action not found: 404
- Prompt not found: 404
- Bedrock timeout: 504 with message "AI service timeout"
- Bedrock error: 500 with message "AI service error"
- Invalid JSON response: 422 with message "Invalid AI response format"
- Database error: 500

### 2. Shared Module: `lambda/shared/action-scoring.js`

**Purpose**: Reusable logic for building scoring prompts and parsing responses

**Functions**:

```javascript
/**
 * Build scoring prompt with action context
 * @param {Object} action - Action with joined data
 * @param {Object} prompt - Scoring prompt
 * @returns {string} - Complete prompt for Bedrock
 */
function buildScoringPrompt(action, prompt) {
  // Same logic as ActionScoreDialog.generatePrompt()
  // Includes anti-leakage addendum
}

/**
 * Call Bedrock to generate scores
 * @param {string} prompt - Complete prompt
 * @returns {Promise<Object>} - Parsed AI response
 */
async function generateScoresWithBedrock(prompt) {
  // Use Claude Haiku (same as ai-summarizer.js)
  // Temperature: 0.3 for consistency
  // Max tokens: 1000 (scores can be verbose)
}

/**
 * Validate and parse AI response
 * @param {Object} response - Raw Bedrock response
 * @returns {Object} - Validated scores and root causes
 * @throws {Error} - If response format is invalid
 */
function parseAndValidateScores(response) {
  // Ensure scores object exists
  // Ensure each score has score (number) and reason (string)
  // Ensure likely_root_causes is array
}
```

### 3. Frontend: UnifiedActionDialog Changes

**File**: `src/components/UnifiedActionDialog.tsx`

**Changes to `handleReadyForReview()`**:

```typescript
const handleReadyForReview = async () => {
  if (!action?.id) return;
  
  if (!(await hasImplementationNotes())) {
    toast({
      title: "Error",
      description: "Please add at least one implementation update before marking as ready for review",
      variant: "destructive"
    });
    return;
  }

  setIsCompleting(true);
  
  try {
    // ... existing stock consumption logic ...
    
    // Complete action (existing logic)
    const actionData = { /* ... */ };
    await saveActionMutation.mutateAsync(actionData);

    // Auto-checkin tools (existing logic)
    await autoCheckinToolsForAction({ /* ... */ });

    // NEW: Trigger auto-scoring in background (don't await)
    triggerAutoScoring(action.id).catch(error => {
      console.error('Auto-scoring failed:', error);
      // Don't show error - scoring is optional enhancement
    });

    // Success handled by mutation onSuccess
  } catch (error) {
    // ... existing error handling ...
  } finally {
    setIsCompleting(false);
  }
};

/**
 * Trigger auto-scoring with default prompt
 * Runs in background, doesn't block completion
 */
const triggerAutoScoring = async (actionId: string) => {
  try {
    await apiService.post('/action-scoring/generate', {
      action_id: actionId,
      auto_save: true // Save directly without review
    });
    
    toast({
      title: "Action scored",
      description: "AI scoring completed successfully",
      duration: 3000
    });
  } catch (error) {
    // Silent failure - user can score manually later
    console.warn('Auto-scoring failed:', error);
  }
};
```

### 4. Frontend: ActionScoreDialog Changes

**File**: `src/components/ActionScoreDialog.tsx`

**New State**:
```typescript
const [isAutoScoring, setIsAutoScoring] = useState(false);
```

**New Button** (add next to "Copy to Clipboard"):
```tsx
<Button 
  variant="default" 
  size="sm"
  onClick={handleAutoScore}
  disabled={!selectedPromptId || isAutoScoring}
>
  {isAutoScoring ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      AI is analyzing...
    </>
  ) : (
    <>
      <Sparkles className="w-4 h-4 mr-2" />
      Auto-Score with AI
    </>
  )}
</Button>
```

**New Handler**:
```typescript
const handleAutoScore = async () => {
  if (!selectedPrompt) return;
  
  setIsAutoScoring(true);
  
  try {
    const response = await apiService.post('/action-scoring/generate', {
      action_id: action.id,
      prompt_id: selectedPromptId,
      auto_save: false // Return for review
    });
    
    const { scores, likely_root_causes, ai_response } = response.data;
    
    // Populate form for review (existing logic)
    setParsedScores(scores);
    setRootCauses(likely_root_causes);
    setAiResponse(JSON.stringify(ai_response, null, 2));
    setShowScoreForm(true);
    
    toast({
      title: "AI scoring complete",
      description: "Review the scores below and save when ready"
    });
  } catch (error: any) {
    console.error('Auto-scoring failed:', error);
    
    const errorMsg = error?.response?.data?.error || "AI scoring failed";
    toast({
      title: "Auto-scoring failed",
      description: `${errorMsg}. You can use the manual copy-paste flow as a fallback.`,
      variant: "destructive"
    });
  } finally {
    setIsAutoScoring(false);
  }
};
```

### 5. Frontend: New Hook `useActionScoring`

**File**: `src/hooks/useActionScoring.tsx`

**Purpose**: Encapsulate auto-scoring logic for reuse

```typescript
export const useActionScoring = () => {
  const { toast } = useToast();
  
  const autoScore = async (
    actionId: string, 
    promptId?: string,
    autoSave: boolean = false
  ) => {
    try {
      const response = await apiService.post('/action-scoring/generate', {
        action_id: actionId,
        prompt_id: promptId,
        auto_save: autoSave
      });
      
      return response.data;
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || "AI scoring failed";
      throw new Error(errorMsg);
    }
  };
  
  return { autoScore };
};
```

## Database Schema

No changes required - using existing tables:
- `scoring_prompts`: Stores prompt templates
- `action_scores`: Stores generated scores

## API Endpoints

### New Endpoint

**POST /action-scoring/generate**
- Lambda: `cwf-action-scoring`
- Auth: Required (organization-scoped)
- Rate limit: 10 requests/minute per user

## Bedrock Configuration

**Model**: `anthropic.claude-3-5-haiku-20241022-v1:0` (same as embeddings)

**Parameters**:
```javascript
{
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 1000, // Scores can be verbose
  temperature: 0.3,  // Consistency over creativity
  messages: [{ role: "user", content: prompt }]
}
```

**Timeout**: 10 seconds

**Region**: us-west-2

## Error Handling Strategy

### Auto-Scoring from "Ready for Review"
- **Bedrock timeout**: Log error, don't notify user
- **Bedrock error**: Log error, don't notify user
- **Invalid response**: Log error, don't notify user
- **Database error**: Log error, don't notify user

**Rationale**: Scoring is optional enhancement, shouldn't block completion

### Manual Auto-Scoring from ActionScoreDialog
- **Bedrock timeout**: Show error toast with fallback suggestion
- **Bedrock error**: Show error toast with fallback suggestion
- **Invalid response**: Show error toast with details
- **Database error**: Show error toast

**Rationale**: User explicitly requested scoring, needs feedback

## Security Considerations

1. **Organization Scoping**: Lambda authorizer ensures user can only score actions in their organization
2. **Prompt Validation**: Verify prompt belongs to user's organization
3. **Action Validation**: Verify action belongs to user's organization
4. **Input Sanitization**: Sanitize action data before sending to Bedrock
5. **Response Sanitization**: Validate and sanitize Bedrock response before storage
6. **Rate Limiting**: Prevent abuse of Bedrock API

## Testing Strategy

### Unit Tests
- `lambda/action-scoring/index.test.js`: Test Lambda handler
- `lambda/shared/action-scoring.test.js`: Test shared functions
- `src/hooks/useActionScoring.test.tsx`: Test React hook

### Integration Tests
- Test auto-scoring from "Ready for Review" button
- Test manual auto-scoring from ActionScoreDialog
- Test re-scoring existing actions
- Test error handling and fallback flows
- Test with various scoring prompts

### Manual Testing
- Test with real Bedrock API
- Verify prompt context includes all action data
- Verify scores are saved correctly
- Verify backward compatibility with manual flow

## Deployment Plan

1. Deploy new Lambda function `cwf-action-scoring`
2. Wire API Gateway endpoint `/action-scoring/generate`
3. Deploy frontend changes (UnifiedActionDialog, ActionScoreDialog)
4. Test in production with single action
5. Monitor Bedrock usage and costs
6. Gradually roll out to all users

## Monitoring

- CloudWatch metrics for Lambda invocations
- CloudWatch logs for Bedrock errors
- Track auto-scoring success rate
- Track manual vs auto-scoring usage
- Monitor Bedrock API costs

## Cost Estimation

**Bedrock Claude Haiku Pricing** (us-west-2):
- Input: $0.25 per 1M tokens
- Output: $1.25 per 1M tokens

**Estimated per scoring**:
- Input tokens: ~1,500 (action context + prompt)
- Output tokens: ~500 (scores JSON)
- Cost per scoring: ~$0.001 (0.1 cents)

**Monthly estimate** (100 actions/day):
- 3,000 scorings/month
- Cost: ~$3/month

Very affordable for the automation benefit.

## Future Enhancements (Out of Scope)

- Batch scoring of multiple actions
- Score analytics dashboard
- Custom AI models or fine-tuning
- Scoring suggestions during action creation
- Automated scoring quality feedback loop
