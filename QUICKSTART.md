# Quick Start Guide: Sari-Sari Chat

## 🚀 Get Started in 3 Steps

### Step 1: Deploy the Lambda
```bash
cd /Users/stefanhamilton/dev/clever-widget-factory
./scripts/deploy-sari-sari-chat.sh
```

### Step 2: Start the Frontend
```bash
npm run dev
```

### Step 3: Test the Chat
1. Open http://localhost:8080
2. Click "Sari Sari Store" from Dashboard
3. Try these queries:

## 📝 Example Queries to Try

### Basic Search
```
"Show me vegetables"
"What products do you have?"
"Show me available items"
```

### Price Filtering
```
"Show me items under ₱50"
"I need vegetables under ₱100"
"What's available for less than ₱30?"
```

### Negation (Exclusion)
```
"Show me rice but not jasmine rice"
"I need vegetables but not tomatoes"
"Fresh produce except carrots"
```

### Combined Queries
```
"Show me vegetables under ₱50 but not tomatoes"
"I need rice under ₱100 but not jasmine"
"Fresh items under ₱30"
```

### Conversational
```
"Hello!"
"What's fresh today?"
"Help me find something"
```

## 🔍 What to Look For

### ✅ Success Indicators
- Bot responds within 2-3 seconds
- Products displayed with prices
- Availability badges (in-stock, low-stock, out-of-stock)
- Conversational response mentions filters applied
- Suggestion chips appear below response

### ❌ Issues to Watch
- Response takes >5 seconds
- No products returned for valid queries
- Error messages in chat
- Products don't match query intent

## 🐛 Debugging

### Check Frontend Console
```javascript
// Look for these logs:
"🔍 User query: ..."
"🤖 Calling sari-sari chat Lambda..."
"✅ Lambda response: ..."
"🔍 Pipeline debug info: ..."
```

### Check Lambda Logs
```bash
# View recent logs
aws logs tail /aws/lambda/sari-sari-chat --follow --region us-west-2

# Look for:
# - Request ID
# - Pipeline step execution
# - Intent extraction results
# - Search results count
```

### Test Lambda Directly
```bash
# Test with simple query
aws lambda invoke \
  --function-name sari-sari-chat \
  --payload '{"body":"{\"message\":\"Show me vegetables\",\"sessionId\":\"test-123\"}"}' \
  --region us-west-2 \
  response.json

# View response
cat response.json | jq
```

## 📊 Expected Results

### Query: "Show me vegetables under ₱50"

**Expected Response:**
```json
{
  "intent": {
    "intent": "PRODUCT_SEARCH",
    "confidence": 0.95,
    "productTerms": ["vegetables"],
    "priceConstraints": { "max": 50 },
    "negatedTerms": []
  },
  "response": "Found X vegetables under ₱50! Here's what matches your request:",
  "products": [
    {
      "id": "...",
      "name": "Tomatoes",
      "price": 45.00,
      "availability": "in-stock",
      "unit": "kg",
      "current_quantity": 25
    }
  ]
}
```

**UI Display:**
- Chat bubble with conversational response
- Product cards showing:
  - Product name
  - Price with unit
  - Availability badge
  - "Add to Cart" button
  - Current quantity

## 🎯 Testing Checklist

- [ ] Basic product search works
- [ ] Price filtering works (under/above)
- [ ] Negation works (but not X)
- [ ] Combined filters work
- [ ] Conversational responses are natural
- [ ] Products display correctly
- [ ] Availability badges show correct status
- [ ] Response time is acceptable (<3s)
- [ ] Error handling works gracefully
- [ ] Suggestion chips are relevant

## 🔧 Troubleshooting

### Issue: No products returned
**Check:**
1. Are there sellable products in database?
   ```sql
   SELECT COUNT(*) FROM parts WHERE sellable = true;
   ```
2. Is organization_id correct in request?
3. Check Lambda logs for errors

### Issue: Slow responses
**Check:**
1. Bedrock API latency
2. Database query performance
3. Embedding generation time
4. Check CloudWatch metrics

### Issue: Wrong products returned
**Check:**
1. Intent extraction accuracy
2. Semantic search relevance
3. Filter application
4. Check debug output in response

### Issue: Frontend errors
**Check:**
1. API endpoint configuration
2. CORS settings
3. Authentication token
4. Network tab in browser DevTools

## 📚 Additional Resources

- [Integration Guide](lambda/sari-sari-chat/INTEGRATION.md)
- [Architecture Diagram](ARCHITECTURE_DIAGRAM.md)
- [Full Integration Summary](SEARCHPIPELINE_INTEGRATION.md)

## 🎉 Success!

If you can:
1. ✅ Type a query
2. ✅ See products returned
3. ✅ Read conversational response
4. ✅ View product details

**Congratulations! The SearchPipeline is working! 🎊**

## 🚀 Next Steps

1. Test with real users
2. Gather feedback on search quality
3. Monitor CloudWatch metrics
4. Iterate on pipeline improvements
5. Add shopping cart functionality
6. Implement order placement

## 💡 Pro Tips

- Use debug mode to see pipeline internals
- Try edge cases (empty results, typos)
- Test with different product types
- Experiment with complex queries
- Monitor response times
- Check semantic search relevance

## 🆘 Need Help?

Check the logs:
```bash
# Frontend console (browser DevTools)
# Lambda logs (CloudWatch)
aws logs tail /aws/lambda/sari-sari-chat --follow

# API Gateway logs
aws logs tail /aws/apigateway/sari-sari-chat --follow
```

Happy testing! 🎈
