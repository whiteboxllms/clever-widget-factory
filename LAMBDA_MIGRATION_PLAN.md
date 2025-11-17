# Lambda Migration Plan

## Overview
Convert local Express server to AWS Lambda + API Gateway architecture for better scalability, monitoring, and cost efficiency.

## Phase 1: Infrastructure Setup ⏳

### 1.1 API Gateway Setup
- [ ] Create REST API Gateway in us-west-2
- [ ] Configure CORS for frontend domain
- [ ] Set up custom domain (optional)
- [ ] Enable request/response logging

### 1.2 RDS Proxy Setup
- [ ] Create RDS Proxy for connection pooling
- [ ] Configure IAM authentication
- [ ] Set connection limits and timeouts
- [ ] Test proxy connectivity

### 1.3 Shared Lambda Layer
- [ ] Create database layer (pg client)
- [ ] Create utils layer (validation, formatting)
- [ ] Create auth layer (Cognito helpers)
- [ ] Deploy layers to AWS

## Phase 2: Lambda Functions

### 2.1 Core Lambda (Priority 1)
**Endpoints:** `/health`, `/query`, `/schema`
- [ ] Create core-lambda function
- [ ] Implement health check
- [ ] Implement generic query endpoint
- [ ] Deploy and test

### 2.2 Organization Lambda (Priority 2)
**Endpoints:** `/organization_members`, `/organization_members/*`
- [ ] Create org-lambda function
- [ ] Migrate organization members endpoints
- [ ] Test assignee dropdown functionality
- [ ] Deploy and test

### 2.3 Actions Lambda (Priority 3)
**Endpoints:** `/actions`, `/actions/*`
- [ ] Enhance existing actions-lambda
- [ ] Add missing action endpoints
- [ ] Implement caching strategy
- [ ] Deploy and test

### 2.4 Inventory Lambda (Priority 4)
**Endpoints:** `/tools`, `/parts`, `/tools/search`, `/parts/search`
- [ ] Create inventory-lambda function
- [ ] Migrate tools endpoints
- [ ] Migrate parts endpoints
- [ ] Implement search functionality
- [ ] Deploy and test

### 2.5 Analytics Lambda (Priority 5)
**Endpoints:** `/action_scores`, `/scoring_prompts`, `/analytics/*`
- [ ] Create analytics-lambda function
- [ ] Migrate scoring endpoints
- [ ] Optimize for heavy queries
- [ ] Deploy and test

## Phase 3: API Gateway Integration

### 3.1 Resource Configuration
```
API Gateway Resources:
├── /health → core-lambda
├── /query → core-lambda
├── /schema → core-lambda
├── /organization_members → org-lambda
├── /actions → actions-lambda
├── /tools → inventory-lambda
├── /parts → inventory-lambda
└── /analytics → analytics-lambda
```

### 3.2 Method Configuration
- [ ] Configure GET/POST/PUT/DELETE methods per resource
- [ ] Set up request validation
- [ ] Configure response models
- [ ] Enable caching where appropriate

## Phase 4: Frontend Migration

### 4.1 API Client Updates
- [ ] Update VITE_API_BASE_URL to API Gateway URL
- [ ] Remove offline client complexity
- [ ] Simplify apiService.ts
- [ ] Add proper error handling

### 4.2 Component Updates
- [ ] Test all components with new endpoints
- [ ] Update error handling
- [ ] Remove local server dependencies
- [ ] Performance testing

## Phase 5: Monitoring & Optimization

### 5.1 Observability
- [ ] Set up CloudWatch dashboards
- [ ] Configure X-Ray tracing
- [ ] Create custom metrics
- [ ] Set up alerting

### 5.2 Performance Optimization
- [ ] Database query optimization
- [ ] Lambda memory tuning
- [ ] API Gateway caching
- [ ] Connection pool tuning

## Best Practices Implementation

### Code Organization
```
lambda/
├── shared/
│   ├── db-client.js
│   ├── auth-middleware.js
│   ├── cors-headers.js
│   └── error-handler.js
├── core/
│   ├── index.js
│   └── handlers/
├── organization/
│   ├── index.js
│   └── handlers/
├── actions/
│   ├── index.js
│   └── handlers/
├── inventory/
│   ├── index.js
│   └── handlers/
└── analytics/
    ├── index.js
    └── handlers/
```

### Environment Management
- Development: API Gateway stage `dev`
- Staging: API Gateway stage `staging` 
- Production: API Gateway stage `prod`

### Deployment Strategy
- Infrastructure as Code (AWS CDK)
- Automated testing per Lambda
- Blue/green deployments
- Rollback capability

## Success Metrics
- [ ] Response time < 200ms for CRUD operations
- [ ] Response time < 1s for analytics queries
- [ ] 99.9% uptime
- [ ] Cost reduction vs current server
- [ ] Zero data loss during migration

## Rollback Plan
- Keep local server code in git
- Ability to switch VITE_API_BASE_URL back to localhost
- Database remains unchanged (no schema changes)
- API Gateway can be deleted without affecting data

## Timeline Estimate
- Phase 1: 2-3 days
- Phase 2: 4-5 days
- Phase 3: 1-2 days
- Phase 4: 1-2 days
- Phase 5: 2-3 days

**Total: 10-15 days**