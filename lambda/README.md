# Lambda Architecture

## Current State: Modular Monolith

The `core` Lambda is currently a **60,000+ line monolithic API handler** that processes all API Gateway requests. While functional, this creates maintenance and deployment challenges.

## Strategy: Incremental Refactoring

### Phase 1: Modular Monolith (Current Goal)
Refactor `core/index.js` into organized modules while keeping a single Lambda:

```
lambda/core/
├── index.js              # Router only (~100 lines)
├── handlers/
│   ├── tools.js          # All /tools endpoints
│   ├── actions.js        # All /actions endpoints
│   ├── parts.js
│   ├── missions.js
│   └── health.js
├── services/
│   ├── toolService.js    # Business logic
│   └── historyService.js
└── shared/               # Shared utilities (see below)
```

**Benefits:**
- AI-maintainable file sizes (200-500 lines each)
- Clear separation of concerns
- Easier testing and debugging
- Same deployment speed (single Lambda)

### Phase 2: Microservices (Future)
Split into separate Lambdas when needed:

```
lambda/
├── shared/               # Published as @cwf/core-utils npm package
│   ├── db.js
│   ├── auth.js
│   └── response.js
├── tools/
│   ├── package.json      # depends on @cwf/core-utils
│   └── index.js
├── actions/
│   ├── package.json
│   └── index.js
└── parts/
    ├── package.json
    └── index.js
```

**Benefits:**
- Fast deploys (5 sec per endpoint vs 30 sec for monolith)
- Independent scaling
- Gradual rollout of shared utility changes
- Version control for breaking changes

## Shared Utilities

The `lambda/shared/` directory contains utilities used across multiple Lambdas:

### Current Utilities

- **`embeddings.js`** - Bedrock Titan embedding generation
- **`publishAssetEvent.js`** - SQS event publishing for async processing
- **`getSecret.js`** - AWS Secrets Manager helper with caching

### Usage Pattern

**Current (direct import):**
```javascript
const { generateEmbedding } = require('../shared/embeddings');
```

**Future (npm package):**
```javascript
const { generateEmbedding } = require('@cwf/core-utils');
```

### Adding New Shared Utilities

1. Create in `lambda/shared/`
2. Document purpose and usage
3. Keep functions pure and testable
4. Avoid Lambda-specific dependencies (for future npm package)

## Database Access

**Current:** Each Lambda uses environment variable `DB_PASSWORD`
- Set via GitHub Actions during deployment
- No AWS Secrets Manager (avoids $0.40/month per secret)

**Future (if needed):** Use `shared/getSecret.js` for Secrets Manager integration

## Cost Considerations

| Approach | Monthly Cost | Deploy Time | Maintenance |
|----------|--------------|-------------|-------------|
| Monolith | $0 | 30 sec | Hard |
| Modular Monolith | $0 | 30 sec | Easy |
| Microservices | $0 | 5 sec/endpoint | Easy |
| Lambda Layers | $0 | 30 sec (all) | Medium |
| Secrets Manager | +$0.40/secret | - | - |

## Migration Checklist

### Phase 1: Modular Monolith
- [ ] Extract `shared/db.js` with query helpers
- [ ] Extract `shared/response.js` with standard responses
- [ ] Move `/tools` to `handlers/tools.js`
- [ ] Move `/actions` to `handlers/actions.js`
- [ ] Move `/parts` to `handlers/parts.js`
- [ ] Extract business logic to `services/`
- [ ] Update `index.js` to route to handlers

### Phase 2: Microservices (When Needed)
- [ ] Publish `shared/` as `@cwf/core-utils` npm package
- [ ] Create separate Lambda for `/tools`
- [ ] Update API Gateway routing
- [ ] Migrate remaining endpoints one-by-one

## Best Practices

1. **Keep handlers thin** - Route to services for business logic
2. **Keep services pure** - No HTTP concerns, just business logic
3. **Keep shared utilities generic** - Avoid endpoint-specific code
4. **Test in isolation** - Each handler/service should be unit testable
5. **Document breaking changes** - Especially in shared utilities

## Questions?

See main project README for overall architecture and development setup.
