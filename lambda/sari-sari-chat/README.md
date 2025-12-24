# Sari-Sari Chat Lambda

Lambda function for sari-sari store chat with NLP intent extraction using AWS Bedrock.

## Architecture

- **Frontend**: `src/pages/SariSariChat.tsx` calls Lambda via API Gateway
- **Lambda**: Handles Bedrock NLP, database queries, response generation
- **API Endpoint**: `POST /api/sari-sari/chat`

## Deployment

```bash
./deploy.sh
```

## Environment Variables

- `BEDROCK_MODEL_ID`: Claude model ID (default: `anthropic.claude-3-5-haiku-20241022-v1:0`)

## Request Format

```json
{
  "message": "show me products",
  "sessionId": "session-123"
}
```

## Response Format

```json
{
  "intent": {
    "intent": "PRODUCT_SEARCH",
    "confidence": 0.95,
    "extractedQuery": "products"
  },
  "response": "Found 5 products...",
  "products": [...],
  "sessionId": "session-123"
}
```

## Cost

- Claude 3.5 Haiku: ~$0.28 per 1K requests
- Much cheaper than Claude 3.5 Sonnet ($1.05 per 1K)
