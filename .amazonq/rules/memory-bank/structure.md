# Clever Widget Factory - Project Structure

## Directory Organization

### `/src` - Frontend Application
React + TypeScript application with Vite build system.

#### `/src/components` - UI Components
- **Dialog Components**: Action, Mission, Issue, Tool, Part, Exploration dialogs
- **Card Components**: Display components for entities (ActionCard, IssueCard, etc.)
- **Form Components**: Reusable form inputs and editors (TiptapEditor, ParticipantSelector)
- **Chart Components**: Analytics visualizations (ActionUpdatesChart, InventoryTrackingChart)
- **Route Guards**: ProtectedRoute, AdminRoute, LeadershipRoute, SuperAdminRoute
- **Shared Components**: Common UI elements in `/components/shared`
- **Tool Components**: Tool-specific components in `/components/tools`
- **UI Primitives**: shadcn-ui components in `/components/ui`

#### `/src/pages` - Route Pages
- **Actions.tsx**: Main action management interface
- **Missions.tsx**: Mission planning and tracking
- **Issues.tsx**: Issue reporting and resolution
- **CombinedAssets.tsx**: Unified tool and part browser
- **Explorations.tsx**: Exploration data collection interface
- **AnalyticsDashboard.tsx**: Metrics and visualizations
- **Organization.tsx**: Organization settings and members
- **SariSariChat.tsx**: AI-powered chat interface
- **Auth.tsx**: Authentication flows

#### `/src/hooks` - Custom React Hooks
- **Data Hooks**: useActions, useCombinedAssets, useExplorations, useOrganizationMembers
- **Mutation Hooks**: useActionMutations, useAssetMutations, useCheckoutMutations
- **Auth Hooks**: useCognitoAuth, useProfile, useOrganizationId
- **Feature Hooks**: useFiveWhysAgent, useImageUpload, useInventoryTracking
- **Tool Hooks**: Tool-specific hooks in `/hooks/tools`

#### `/src/lib` - Core Libraries
- **apiService.ts**: HTTP client for AWS API Gateway endpoints
- **authService.ts**: AWS Cognito authentication wrapper
- **queryConfig.ts**: TanStack Query configuration
- **queryKeys.ts**: Centralized query key definitions
- **offlineDB.ts**: Dexie IndexedDB for offline storage
- **syncService.ts**: Background sync for offline mutations
- **utils.ts**: Common utility functions

#### `/src/services` - Business Logic Services
- **actionService.ts**: Action CRUD operations
- **explorationService.ts**: Exploration data management
- **policyService.ts**: Policy CRUD and linking
- **aiContentService.ts**: AI-powered content generation
- **semanticSearchService.ts**: Bedrock-powered semantic search
- **embeddingService.ts**: Embedding generation and management

#### `/src/types` - TypeScript Definitions
- **actions.ts**: Action, Mission, Issue types
- **issues.ts**: Issue-specific types
- **organization.ts**: Organization and member types

#### `/src/tests` - Test Suites
- **exploration-data-collection/**: Exploration system tests
- **exploration-status-system/**: Status workflow tests

### `/lambda` - AWS Lambda Functions
Serverless backend functions deployed to AWS Lambda.

#### `/lambda/core` - Core API Lambda
Main API handler for CRUD operations on all entities (actions, missions, issues, tools, parts, etc.).

#### `/lambda/semantic-search` - Semantic Search Lambda
Handles semantic search requests using AWS Bedrock Titan embeddings and pgvector.

#### `/lambda/embeddings-processor` - Embeddings Lambda
Generates embeddings for tools and parts, triggered by database changes.

#### `/lambda/authorizer` - API Gateway Authorizer
JWT token validation for AWS Cognito authentication.

#### `/lambda/sari-sari-chat` - Chat Interface Lambda
AI-powered conversational interface for querying organizational data.

#### `/lambda/analysis` - Analytics Lambda
Action scoring and strategic attribute analysis.

#### `/lambda/shared` - Shared Lambda Code
Common utilities used across multiple Lambda functions:
- **db.js**: PostgreSQL connection pooling
- **embeddings.js**: Embedding generation utilities
- **auth.js**: Authentication helpers
- **response.js**: HTTP response formatting

### `/scripts` - Automation Scripts
Operational scripts for deployment, backfill, and maintenance.

#### `/scripts/deploy` - Deployment Scripts
- **deploy-lambda-with-layer.sh**: Deploy Lambda with shared layer
- **deploy-semantic-search.sh**: Deploy semantic search Lambda
- **pre-deploy-check.sh**: Validation before deployment

#### `/scripts/backfill` - Data Backfill Scripts
- **backfill-embeddings-full-context.sh**: Generate embeddings for all assets
- **regenerate-embeddings.sh**: Regenerate embeddings after schema changes

#### `/scripts/verify` - Verification Scripts
- **verify-api-authorizers.sh**: Ensure all endpoints have authorizers
- **verify-unified-embeddings-schema.sh**: Validate embedding schema

### `/migrations` - Database Migrations
SQL migration scripts for schema changes.

### `/cloudformation` - Infrastructure as Code
AWS CloudFormation templates for infrastructure provisioning.

### `/docs` - Documentation
Technical documentation, architecture diagrams, and troubleshooting guides.

### `/tests` - Integration Tests
API endpoint tests and integration test scripts.

### `/.kiro` - Kiro Development Specs
Kiro AI assistant specifications and development workflows.

#### `/.kiro/specs` - Feature Specifications
- **action-scoring-refactor/**: Analysis system architecture (analyses, scores, attributes, contexts)
- **unified-embeddings-system/**: Cross-entity semantic search design
- **exploration-data-collection/**: Exploration workflow requirements
- **exploration-status-system/**: Status workflow design

#### `/.kiro/steering` - Development Guidelines
- **Code Conventions.md**: Architecture patterns, migration protocols, root cause analysis
- **product.md**: Product vision and requirements
- **tech.md**: Technology decisions and rationale

#### `/.kiro/hooks` - Automation Hooks
- **setup-new-endpoint.kiro.hook**: Guided API endpoint creation workflow
- **pre-commit-security-check.kiro.hook**: Security validation before commits

## Core Architectural Patterns

### Frontend Architecture
- **Component-Based**: React functional components with hooks
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: React Router v7 with protected routes
- **Styling**: Tailwind CSS with shadcn-ui components
- **Forms**: React Hook Form with Zod validation
- **Offline Support**: Dexie IndexedDB with background sync

### Backend Architecture
- **Serverless**: AWS Lambda functions with API Gateway
- **Database**: AWS RDS PostgreSQL with connection pooling
- **Authentication**: AWS Cognito with JWT tokens
- **Storage**: AWS S3 for images and files
- **AI/ML**: AWS Bedrock for embeddings and content generation
- **Vector Search**: PostgreSQL pgvector extension

### Data Flow Patterns
1. **Query Pattern**: Component → TanStack Query → apiService → API Gateway → Lambda → RDS
2. **Mutation Pattern**: Component → Mutation Hook → apiService → API Gateway → Lambda → RDS → Query Invalidation
3. **Offline Pattern**: Component → Mutation → IndexedDB Queue → Background Sync → API
4. **Search Pattern**: Component → semanticSearchService → API Gateway → Semantic Search Lambda → Bedrock + pgvector

### Key Design Principles
- **Store IDs, Not Objects**: Use TanStack Query cache as source of truth (see README TanStack Query Cache Pattern)
- **Optimistic Updates**: Update UI immediately, rollback on error
- **Offline-First**: Queue mutations when offline, sync when online
- **Type Safety**: Full TypeScript coverage with strict mode
- **Component Composition**: Small, focused components with clear responsibilities
