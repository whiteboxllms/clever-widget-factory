# Action Scoring Lambda

Automated action scoring using AWS Bedrock (Claude Haiku).

## Overview

This Lambda function generates accountability scores for completed actions by:
1. Fetching action details with related data (asset, issue, assignee)
2. Building a scoring prompt with action context
3. Calling AWS Bedrock to generate scores
4. Optionally saving scores directly to the database

## API Endpoint

**POST /action-scoring/generate**

### Request Body

```json
{
  "action_id": "uuid",
  "prompt_id": "uuid (optional - uses default if not provided)",
  "auto_save": false
}
```

### Response

```json
{
  "success": true,
  "data": {
    "scores": {
      "planning": {
        "score": 8,
        "reason": "Good planning with clear objectives"
      },
      "execution": {
        "score": 7,
        "reason": "Well executed with minor issues"
      }
    },
    "likely_root_causes": ["Time pressure", "Lack of tools"],
    "ai_response": { /* full AI response */ },
    "prompt_id": "uuid",
    "prompt_text": "Score this action...",
    "asset_context_id": "uuid or null",
    "asset_context_name": "Tool name or null",
    "saved": true
  }
}
```

### Error Responses

- **400**: Missing required fields
- **401**: Unauthorized (missing organization context)
- **404**: Action or prompt not found
- **422**: Invalid AI response format
- **503**: AI service error
- **504**: AI service timeout

## Environment Variables

- `DB_HOST`: PostgreSQL host
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (true/false)
- `AWS_REGION`: AWS region (default: us-west-2)
- `NODE_ENV`: Environment (development/production)

## Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Deploy Lambda

```bash
./deploy.sh
```

This will:
- Install production dependencies
- Create deployment package
- Update or create Lambda function
- Configure environment variables

### 3. Wire to API Gateway

```bash
./wire-api-gateway.sh
```

This will:
- Create API Gateway resources
- Set up POST and OPTIONS methods
- Configure Lambda integration
- Set up CORS
- Deploy to prod stage

### 4. Test Endpoint

```bash
curl -X POST https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/prod/action-scoring/generate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "action_id": "YOUR_ACTION_ID",
    "auto_save": false
  }'
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

1. Create a completed action in the UI
2. Get an auth token (see scripts/get-auth-token-instructions.md)
3. Call the endpoint with curl or Postman
4. Verify scores are returned correctly
5. Test with `auto_save: true` to verify database save

## Architecture

```
Request → API Gateway → Lambda Authorizer → Action Scoring Lambda
                                                    ↓
                                            Fetch Action (RDS)
                                                    ↓
                                            Fetch Prompt (RDS)
                                                    ↓
                                            Build Prompt
                                                    ↓
                                            Call Bedrock
                                                    ↓
                                            Parse Response
                                                    ↓
                                    (if auto_save) Save to RDS
                                                    ↓
                                            Return Scores
```

## Shared Module

This Lambda uses `lambda/shared/action-scoring.js` for:
- `buildScoringPrompt()`: Build prompt with action context
- `generateScoresWithBedrock()`: Call Bedrock API
- `parseAndValidateScores()`: Validate AI response

## Bedrock Configuration

- **Model**: `anthropic.claude-3-5-haiku-20241022-v1:0`
- **Max Tokens**: 1000
- **Temperature**: 0.3 (consistency over creativity)
- **Timeout**: 10 seconds

## Cost Estimation

- Input: ~1,500 tokens per request
- Output: ~500 tokens per request
- Cost: ~$0.001 per scoring (0.1 cents)
- Monthly (100 actions/day): ~$3

## Monitoring

### CloudWatch Logs

- Log group: `/aws/lambda/cwf-action-scoring`
- Logs include: request details, Bedrock calls, errors

### CloudWatch Metrics

- Invocations
- Errors
- Duration
- Throttles

### Alarms

Set up alarms for:
- Error rate > 5%
- Duration > 25 seconds
- Throttles > 0

## Troubleshooting

### "Action not found"

- Verify action exists in database
- Verify action belongs to user's organization
- Check Lambda authorizer is passing organization_id

### "No default scoring prompt found"

- Create a default prompt in the UI (Scoring Prompts page)
- Or specify prompt_id in request

### "AI service error"

- Check Bedrock service status
- Verify Lambda has Bedrock permissions
- Check CloudWatch logs for detailed error

### "Invalid AI response format"

- Verify scoring prompt produces valid JSON
- Check prompt includes score categories
- Review AI response in CloudWatch logs

## Security

- Organization-scoped via Lambda authorizer
- Prompt validation (must belong to organization)
- Action validation (must belong to organization)
- Input sanitization before Bedrock call
- Response validation before storage
- Rate limiting via API Gateway

## Future Enhancements

- Batch scoring of multiple actions
- Async scoring via SQS queue
- Score analytics and trending
- Custom AI models or fine-tuning
- Scoring quality feedback loop
