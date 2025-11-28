# API Gateway Endpoint Checklist

## When Adding New Endpoints

1. **Add endpoint handler to Lambda** (`lambda/core/index.js`)
2. **Create API Gateway resource and method:**
   ```bash
   ./scripts/add-api-endpoint.sh /api/your-endpoint GET
   ```
3. **Verify authorizer is configured:**
   ```bash
   bash scripts/verify-api-authorizers.sh
   ```
4. **Deploy to prod:**
   ```bash
   aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2
   ```
5. **Test the endpoint:**
   ```bash
   curl https://0720au267k.execute-api.us-west-2.amazonaws.com/prod/api/your-endpoint \
     -H "authorization: Bearer YOUR_TOKEN"
   ```

## Common Mistakes

- ❌ Forgetting to add authorizer (causes empty organization context)
- ❌ Using wrong Lambda function (organization Lambda vs core Lambda)
- ❌ Not deploying after making changes
- ❌ OPTIONS method should NOT have authorizer (CORS preflight)

## Public Endpoints (No Auth Required)

- `/api/health` - Health check
- `/api/schema` - API schema

All other endpoints MUST have authorizer configured.
