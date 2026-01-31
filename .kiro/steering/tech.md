# Technology Stack

## Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (port 8080)
- **UI Components**: shadcn-ui, Radix UI, Tailwind CSS
- **State Management**: TanStack Query (React Query) with offline-first architecture
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v7
- **Rich Text**: Tiptap editor
- **Icons**: Lucide React
- **Image Processing**: browser-image-compression
- **Offline Storage**: IndexedDB via Dexie

## Backend

- **API**: AWS API Gateway + Lambda functions (Node.js)
- **Database**: AWS RDS PostgreSQL with pgvector extension
- **Authentication**: AWS Cognito
- **File Storage**: AWS S3 (bucket: cwf-dev-assets)
- **AI/ML**: AWS Bedrock (Titan Text Embeddings v1, 1536 dimensions)
- **Queue**: AWS SQS for async embedding generation
- **Embeddings**: Unified embeddings table for cross-entity semantic search

## Key Lambda Functions

- `cwf-core-lambda`: Main CRUD operations (tools, parts, actions, etc.)
- `cwf-actions-lambda`: Action-specific operations
- `cwf-explorations-lambda`: Exploration CRUD operations and action-exploration associations
- `cwf-semantic-search`: Bedrock-powered semantic search (legacy - per-table)
- `cwf-unified-search`: Cross-entity semantic search using unified embeddings table
- `sari-sari-chat`: Conversational product search interface
- `cwf-embeddings-processor`: Async embedding generation via SQS queue
- `cwf-embeddings-coverage`: Embedding statistics and coverage reporting
- `cwf-embeddings-regenerate`: On-demand embedding regeneration
- `cwf-presigned-upload`: S3 upload URL generation
- `cwf-image-compressor`: Server-side image processing

## Common Commands

```bash
# Development
npm run dev              # Start Vite dev server (port 8080)
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report

# Lambda Deployment
./scripts/deploy-lambda-generic.sh <function-name>
./scripts/deploy-actions-lambda.sh
./scripts/deploy-semantic-search.sh
./scripts/deploy-sari-sari-chat.sh

# Database
# Run migrations via Lambda:
aws lambda invoke --function-name cwf-db-migration \
  --payload '{"sql":"YOUR_SQL"}' response.json \
  --region us-west-2 --cli-binary-format raw-in-base64-out

# API Gateway
./scripts/add-api-endpoint.sh /api/endpoint-name GET
aws apigateway create-deployment --rest-api-id 0720au267k \
  --stage-name prod --region us-west-2

# Semantic Search
./scripts/backfill-embeddings-full-context.sh  # Generate embeddings
./scripts/search-semantic.sh "query text"       # Test search
```

## Environment Variables

Frontend (.env.local):

- `VITE_API_BASE_URL`: API Gateway URL (without /api suffix)
- `VITE_AWS_REGION`: us-west-2
- `VITE_USER_POOL_ID`: Cognito user pool
- `VITE_USER_POOL_CLIENT_ID`: Cognito app client

Lambda (environment variables):

- `DB_PASSWORD`: RDS password
- `BEDROCK_REGION`: us-west-2
- `S3_BUCKET`: cwf-dev-assets

## Path Aliases

TypeScript path mapping configured in tsconfig.json:

- `@/*` maps to `./src/*`

Example: `import { apiService } from '@/lib/apiService'`


## Unified Embeddings Architecture

The system uses a **unified embeddings table** (`unified_embeddings`) to enable cross-entity semantic search:

- **Entity Types**: parts, tools, actions, issues, policies
- **Embedding Model**: AWS Bedrock Titan v1 (1536 dimensions)
- **Async Generation**: SQS queue + embeddings-processor Lambda
- **Search**: Single query across all entity types via `/api/semantic-search/unified`
- **Use Cases**: 
  - Cross-entity search ("show me everything about banana wine")
  - Certification evidence gathering ("organic farming practices")
  - Enhanced product recommendations (health benefits, use cases)
  - Institutional memory (past experiments, lessons learned)

### Key Design Decisions

1. **Unified Table**: Single `unified_embeddings` table instead of per-entity tables
2. **No Duplication**: Search returns entity_type + entity_id, frontend fetches full details
3. **Backward Compatible**: Inline embeddings (parts.search_embedding) maintained during migration
4. **Rich Descriptions**: embedding_source composed from name + description + policy fields
5. **Organization Scoped**: All queries filtered by organization_id for multi-tenancy

### Migration Path

1. Deploy unified_embeddings table
2. Enable dual writes (inline + unified)
3. Backfill existing entities
4. Switch search to unified table
5. Deprecate inline embeddings

See `.kiro/specs/unified-embeddings-system/` for full specification.
