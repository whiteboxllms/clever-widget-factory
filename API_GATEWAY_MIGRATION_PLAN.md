# API Gateway Migration Plan

## Overview
Converting from direct database access and local API server to AWS API Gateway + Lambda architecture for better monitoring, debugging, and robustness.

## Current Database Access Points

### API Server Endpoints (api/server.js)
- `GET /health` - Health check
- `POST /api/query` - Generic SQL query
- `GET /api/parts` - Parts inventory
- `GET /api/tools` - Tools inventory  
- `GET /api/issues` - Issues tracking
- `GET /api/checkouts` - Tool checkouts
- `GET /api/tools/search` - Tool search
- `GET /api/schema` - Database schema
- `GET /api/organization_members` - Active members
- `GET /api/organization_members/all` - All members
- `GET /api/organization_members/by-email` - Find by email
- `GET /api/action_implementation_updates` - Action updates
- `GET /api/action_scores` - Action scoring
- `GET /api/scoring_prompts` - Scoring prompts
- `GET /api/actions/my-actions` - User-specific actions
- `GET /api/actions` - All actions
- `GET /api/parts_orders` - Parts orders
- `GET /api/parts/search` - Parts search

### Frontend Components Using APIs
- `ActionImplementationUpdates.tsx` - Action updates
- `StockSelector.tsx` - Parts inventory
- `UnifiedActionDialog.tsx` - Action updates check
- `Actions.tsx` - Actions CRUD (via rdsClient)
- `rdsClient.ts` - Centralized API client

### Legacy Supabase Components (Need Migration)
- 20+ components still using Supabase calls
- Authentication components
- Real-time subscriptions
- File uploads (already migrated to S3)

## Migration Plan

### Phase 1: Infrastructure Setup
1. **Create API Gateway**
   - REST API with resource-based routing
   - CORS configuration for frontend
   - Request/response logging
   - Rate limiting and throttling

2. **Create Lambda Functions**
   - One Lambda per major resource (actions, parts, tools, etc.)
   - Shared database connection layer
   - Error handling and logging
   - Input validation

3. **Database Connection Layer**
   - RDS Proxy for connection pooling
   - IAM database authentication
   - Connection retry logic
   - Query logging and metrics

### Phase 2: API Migration
1. **Create Lambda Functions:**
   - `actions-api` - All action-related endpoints
   - `inventory-api` - Parts and tools
   - `organization-api` - Members and settings
   - `scoring-api` - Action scoring system
   - `issues-api` - Issue tracking

2. **API Gateway Routes:**
   ```
   /api/actions/* → actions-api Lambda
   /api/parts/* → inventory-api Lambda  
   /api/tools/* → inventory-api Lambda
   /api/organization/* → organization-api Lambda
   /api/scores/* → scoring-api Lambda
   /api/issues/* → issues-api Lambda
   ```

### Phase 3: Frontend Migration
1. **Update rdsClient.ts**
   - Replace localhost URLs with API Gateway endpoints
   - Add authentication headers (Cognito JWT)
   - Add retry logic and error handling

2. **Update Components**
   - Replace direct fetch calls with rdsClient methods
   - Update error handling for API Gateway responses
   - Add loading states and offline support

### Phase 4: Legacy Cleanup
1. **Migrate Supabase Components**
   - Replace Supabase calls with API Gateway calls
   - Update authentication to use Cognito
   - Remove Supabase dependencies

2. **Remove Local API Server**
   - Delete api/server.js
   - Update development workflow
   - Update deployment scripts

## Benefits After Migration

### Monitoring & Debugging
- CloudWatch logs for every API call
- X-Ray tracing for performance analysis
- Custom metrics for business logic
- Error aggregation and alerting

### Robustness
- Auto-scaling Lambda functions
- RDS Proxy connection pooling
- Built-in retry and circuit breaker patterns
- Multi-AZ database failover

### Security
- IAM-based authentication
- VPC isolation for database access
- Request validation at API Gateway
- No database credentials in frontend

### Future-Ready
- Easy Bedrock integration
- API versioning support
- Caching layers (ElastiCache)
- Event-driven architecture with EventBridge

## Estimated Timeline
- **Phase 1 (Infrastructure):** 2-3 days
- **Phase 2 (API Migration):** 3-4 days  
- **Phase 3 (Frontend):** 1-2 days
- **Phase 4 (Cleanup):** 1-2 days

**Total: ~1-2 weeks**

## Status
- [ ] Phase 1: Infrastructure Setup
- [ ] Phase 2: API Migration
- [ ] Phase 3: Frontend Migration
- [ ] Phase 4: Legacy Cleanup
