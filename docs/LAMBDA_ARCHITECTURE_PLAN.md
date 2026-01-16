# Lambda Architecture Modernization Plan
**Project:** Clever Widget Factory  
**Date:** January 15, 2026  
**Status:** Approved for Implementation

---

## Executive Summary

Migrate from monolithic Lambda architecture to resource-specific Lambdas with shared layer. This improves deployment speed, code clarity, and operational control while maintaining simplicity.

**Key Benefits:**
- 10x faster deployments (5s vs 30s)
- Clear versioning of shared code
- Independent resource deployments
- Better security (per-Lambda IAM roles)

---

## Current Architecture (Problems)

```
cwf-core-lambda (3MB monolith)
├── Tools, Parts, Missions, Checkouts, Profiles
├── Issues, Policies, Explorations, Organizations
├── Embeddings, AI, Analytics, Search
├── node_modules/ (bundled every deploy)
└── ../shared/ (copied, version unclear)

cwf-actions-lambda (3MB)
├── Actions CRUD + complex logic
├── node_modules/ (bundled every deploy)
└── ../shared/ (copied, version unclear)
```

**Pain Points:**
- ❌ Slow deploys (30+ seconds)
- ❌ Large packages (3MB+)
- ❌ Unclear which shared code version is running
- ❌ Can't deploy one resource without affecting others
- ❌ Single IAM role for all operations

---

## Target Architecture (Solution)

### Routing Layer: API Gateway
```
API Gateway (AWS-managed routing)
├── /api/tools → cwf-tools-lambda
├── /api/parts → cwf-parts-lambda
├── /api/missions → cwf-missions-lambda
├── /api/explorations → cwf-explorations-lambda
├── /api/actions → cwf-actions-lambda
└── /api/* → cwf-core-lambda (remaining endpoints)
```

**Why API Gateway routing:**
- ✅ AWS-managed (no code)
- ✅ Built-in metrics per endpoint
- ✅ No extra latency
- ✅ Can add throttling/caching per route

### Shared Code: Lambda Layer
```
cwf-shared-layer (versioned)
└── nodejs/node_modules/
    ├── pg/                    # npm dependencies
    └── @cwf/                  # shared utilities
        ├── db.js
        ├── response.js
        ├── authorizerContext.js
        └── logger.js
```

**Benefits:**
- Deploy once, use everywhere
- Explicit versioning (layer:1, layer:2, etc.)
- No bundling in each Lambda
- Clear which version each Lambda uses

### Resource Lambdas
```
lambda/tools/
├── index.js (~5KB)           # Tools CRUD only
└── deploy.sh

lambda/parts/
├── index.js (~5KB)           # Parts CRUD only
└── deploy.sh

lambda/missions/
├── index.js (~5KB)           # Missions CRUD only
└── deploy.sh

lambda/explorations/
├── index.js (~5KB)           # Explorations CRUD only
└── deploy.sh

lambda/actions/
├── index.js (~10KB)          # Actions + complex logic
└── deploy.sh

lambda/core/
├── index.js (~20KB)          # Remaining resources
└── deploy.sh
```

**All Lambdas:**
- Use `cwf-shared-layer:N`
- Include shared logger for visibility
- Independent IAM roles (Phase 3)

---

## Observability: Centralized Logging

Each Lambda uses shared logger from layer:

```javascript
// In every Lambda handler
const { logRequest } = require('@cwf/logger');

exports.handler = async (event) => {
  logRequest(event);  // Logs: method, path, Lambda, requestId
  // ... handle request
};
```

**Debugging:**
```bash
# See all requests across all Lambdas
aws logs filter-log-events \
  --log-group-name /aws/lambda/cwf-* \
  --filter-pattern "POST /api/explorations"
```

**Visibility:**
- Which Lambda handled request
- Request/response details
- Timing information
- Layer version in use

---

## Implementation Phases

### Phase 1: Proof of Concept (Week 1)
**Goal:** Validate approach with explorations

**Tasks:**
1. Create `cwf-shared-layer` with node_modules + shared code
2. Create `cwf-explorations-lambda` using layer
3. Update API Gateway: `/api/explorations/*` → new Lambda
4. Test & validate

**Success Criteria:**
- ✅ Explorations API works
- ✅ Deploy takes <10 seconds
- ✅ Layer version visible in logs
- ✅ No impact on other endpoints

**Rollback:** Point API Gateway back to core-lambda

---

### Phase 2: Extract High-Change Resources (Week 2-3)
**Goal:** Split frequently-changed resources

**Extract these (in order):**
1. Tools (most frequently changed)
2. Parts (frequently changed)
3. Missions (frequently changed)

**For each resource:**
1. Create `lambda/{resource}/index.js`
2. Deploy Lambda with layer
3. Update API Gateway route
4. Test endpoint
5. Remove code from core-lambda

**Success Criteria:**
- ✅ Each resource works independently
- ✅ Fast deploys (5-10 seconds)
- ✅ Core-lambda still handles other endpoints

---

### Phase 3: Optimize (Week 4)
**Goal:** Per-Lambda IAM roles and monitoring

**Tasks:**
1. Create resource-specific IAM roles
   - `cwf-tools-role`: RDS + CloudWatch only
   - `cwf-ai-role`: RDS + Bedrock + CloudWatch
2. Create monitoring scripts
   - `scripts/check-layer-versions.sh`
   - `scripts/deploy-all.sh`
3. Update documentation

**Success Criteria:**
- ✅ Least-privilege IAM per Lambda
- ✅ Easy to see which layer version is deployed
- ✅ One-command deployment

---

## Deployment Workflow

### Shared Code Changes
```bash
# 1. Update shared code
cd lambda-layer/nodejs/node_modules/@cwf
# Edit db.js, response.js, etc.

# 2. Deploy layer (once)
cd ../../../../lambda-layer
./deploy-layer.sh
# Output: Published layer version 6

# 3. Update all Lambdas to use new layer
./scripts/update-all-lambdas.sh 6

# 4. Verify
./scripts/check-layer-versions.sh
```

### Resource Code Changes
```bash
# Deploy just one Lambda (fast!)
cd lambda/tools
./deploy.sh
# Output: Deployed in 5 seconds
```

---

## Comparison: Before vs After

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Deploy size | 3MB | 5KB | 600x smaller |
| Deploy time | 30s | 5s | 6x faster |
| Shared code clarity | Unknown | Layer version visible | Clear |
| Blast radius | All resources | One resource | Isolated |
| IAM granularity | One role | Per-Lambda | Secure |
| Debugging | Unclear | Centralized logs | Easy |

---

## Risk Mitigation

### Phase 1 Risks
**Risk:** Layer doesn't work  
**Mitigation:** Test with explorations only, easy rollback

**Risk:** Performance degradation  
**Mitigation:** Monitor latency, layer adds <1ms

### Phase 2 Risks
**Risk:** Break existing endpoints  
**Mitigation:** Gradual migration, test each resource

**Risk:** API Gateway misconfiguration  
**Mitigation:** Keep core-lambda as fallback

### Phase 3 Risks
**Risk:** IAM permission issues  
**Mitigation:** Start with broad permissions, narrow gradually

---

## Success Metrics

**Deployment Speed:**
- Target: <10 seconds per Lambda
- Measure: Time from `./deploy.sh` to Lambda ready

**Code Clarity:**
- Target: Know layer version for each Lambda
- Measure: `./scripts/check-layer-versions.sh` output

**Operational Control:**
- Target: Deploy one resource without affecting others
- Measure: Deploy tools, verify parts still works

**Developer Experience:**
- Target: Faster iteration on individual resources
- Measure: Developer feedback after 2 weeks

---

## Decision Points

**After Phase 1:**
- ✅ Continue if: Fast deploys + clear versioning
- ❌ Stop if: Too complex or performance issues

**After Phase 2:**
- ✅ Continue to Phase 3 if: Benefits realized
- ⏸️ Pause if: Need to stabilize

---

## Rollback Plan

**Phase 1 failure:**
- Delete explorations Lambda
- Point API Gateway back to core
- Zero impact

**Phase 2 failure:**
- Keep new Lambdas deployed
- Point API Gateway back to core
- Debug separately

**Layer issues:**
- Update Lambda to use previous layer version
- Fix layer and republish
- Update Lambdas to new version

---

## Timeline

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Phase 1 | Explorations Lambda + Layer working |
| 2 | Phase 2.1 | Tools, Parts, Missions extracted |
| 3 | Phase 2.2 | Core-lambda cleaned up |
| 4 | Phase 3 | IAM roles + monitoring |

**Total:** 4 weeks to complete migration

---

## Approval

**Recommended by:** Stefan Hamilton  
**Date:** January 15, 2026  
**Status:** ✅ Approved for Phase 1 implementation

**Next Steps:**
1. Create lambda-layer structure
2. Create explorations Lambda
3. Test and validate
4. Review results before Phase 2
