# Sari-Sari Chat Integration

## Overview
The Sari-Sari Chat is a conversational shopping assistant that uses the SearchPipeline to provide intelligent product search and recommendations.

## Architecture

### Backend (Lambda)
- **Function**: `sari-sari-chat`
- **Endpoint**: `POST /api/sari-sari/chat`
- **Pipeline**: Uses the 5-step SearchPipeline orchestrator

#### SearchPipeline Steps:
1. **Query Rewriting** - Extracts intent and product terms using Bedrock Claude
2. **Filter Mapping** - Maps price constraints and negation terms
3. **Hybrid Retrieval** - Combines semantic search with filtering
4. **Result Formatting** - Formats products with availability status
5. **Response Generation** - Creates conversational responses using Bedrock

### Frontend (React)
- **Page**: `/sari-sari-chat`
- **Component**: `src/pages/SariSariChat.tsx`
- **Features**:
  - Real-time chat interface
  - Product cards with pricing and availability
  - Suggestion chips for quick queries
  - Auto-refresh product inventory

## Usage

### User Flow
1. Navigate to "Sari Sari Store" from Dashboard
2. Type natural language queries like:
   - "Show me vegetables under ₱50"
   - "I need rice but not jasmine rice"
   - "What fresh produce do you have?"
3. View AI-powered product recommendations
4. Add items to cart (future feature)

### Example Queries
```
✅ "Show me vegetables"
✅ "I need rice under ₱100"
✅ "Fresh produce but not tomatoes"
✅ "What's available today?"
✅ "Show me items under ₱50"
```

## API Request/Response

### Request
```json
{
  "message": "Show me vegetables under ₱50",
  "sessionId": "session-1234567890"
}
```

### Response
```json
{
  "intent": {
    "intent": "PRODUCT_SEARCH",
    "confidence": 0.95,
    "productTerms": ["vegetables"],
    "priceConstraints": { "max": 50 },
    "negatedTerms": []
  },
  "response": "Found 5 vegetables under ₱50! Here's what matches your request:",
  "products": [
    {
      "id": "uuid",
      "name": "Tomatoes",
      "price": 45.00,
      "availability": "in-stock",
      "description": "Fresh organic tomatoes",
      "unit": "kg",
      "current_quantity": 25
    }
  ],
  "sessionId": "session-1234567890",
  "debug": { /* pipeline debug info */ }
}
```

## Configuration

### Environment Variables
- `BEDROCK_MODEL_ID` - Claude model for intent extraction (default: `anthropic.claude-3-5-haiku-20241022-v1:0`)
- `AWS_REGION` - AWS region for Bedrock (default: `us-west-2`)

### Frontend Environment
- `VITE_API_BASE_URL` - API Gateway base URL (without `/api` suffix)

## Testing

### Manual Testing
1. Start frontend: `npm run dev`
2. Navigate to http://localhost:8080/sari-sari-chat
3. Try various queries to test pipeline

### Lambda Testing
```bash
aws lambda invoke \
  --function-name sari-sari-chat \
  --payload '{"body":"{\"message\":\"Show me vegetables\",\"sessionId\":\"test-123\"}"}' \
  --region us-west-2 \
  response.json
```

## Future Enhancements
- [ ] Shopping cart functionality
- [ ] Order placement
- [ ] Product recommendations based on history
- [ ] Multi-turn conversation context
- [ ] Image display for products
- [ ] Inventory alerts
