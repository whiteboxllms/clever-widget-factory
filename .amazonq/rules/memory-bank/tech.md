# Clever Widget Factory - Technology Stack

## Programming Languages
- **TypeScript 5.9.3**: Primary language for frontend and type definitions
- **JavaScript (Node.js)**: Lambda functions and backend services
- **SQL**: PostgreSQL database queries and migrations

## Frontend Stack

### Core Framework
- **React 18**: UI library with functional components and hooks
- **Vite**: Build tool and dev server (runs on port 8080)
- **TypeScript**: Type-safe development with strict mode

### UI Components & Styling
- **shadcn-ui**: Component library built on Radix UI
- **Radix UI**: Unstyled, accessible component primitives
- **Tailwind CSS 3.4**: Utility-first CSS framework
- **tailwindcss-animate**: Animation utilities
- **Lucide React**: Icon library

### State Management
- **TanStack Query 5.90**: Server state management with caching
- **React Hook Form 7.70**: Form state and validation
- **Zod 4.3**: Schema validation

### Rich Text & Media
- **Tiptap 3.14**: Rich text editor with extensions
- **browser-image-compression 2.0**: Client-side image optimization
- **date-fns 4.1**: Date manipulation and formatting

### Data Visualization
- **Recharts 3.6**: Chart library for analytics dashboards

### Routing & Navigation
- **React Router DOM 7.11**: Client-side routing with protected routes

### Offline & Storage
- **Dexie 4.2**: IndexedDB wrapper for offline storage
- **TanStack Query Persist Client**: Persist query cache to IndexedDB

## Backend Stack

### Cloud Infrastructure
- **AWS Lambda**: Serverless compute for API endpoints
- **AWS API Gateway**: REST API with JWT authorizer
- **AWS RDS PostgreSQL**: Relational database with pgvector extension
- **AWS Cognito**: User authentication and authorization
- **AWS S3**: Object storage for images and files
- **AWS Bedrock**: AI/ML services (Titan embeddings, Claude)

### Database
- **PostgreSQL 16+**: Primary database with extensions:
  - **pgvector**: Vector similarity search for embeddings
  - **uuid-ossp**: UUID generation

### Lambda Runtime & Dependencies
- **Node.js 20.x**: Lambda runtime
- **pg 8.16**: PostgreSQL client with connection pooling
- **@aws-sdk/client-bedrock-runtime**: Bedrock API client
- **@aws-sdk/client-s3**: S3 API client

## Development Tools

### Testing
- **Vitest 3.2**: Unit and integration testing framework
- **@testing-library/react 16.3**: React component testing
- **@testing-library/user-event 14.6**: User interaction simulation
- **jsdom 27.0**: DOM implementation for testing

### Build & Development
- **Vite**: Fast dev server with HMR
- **@vitejs/plugin-react-swc**: React plugin with SWC compiler
- **TypeScript Compiler**: Type checking and transpilation

### Code Quality
- **ESLint**: Linting and code style enforcement
- **Prettier** (implicit): Code formatting

## Development Commands

### Frontend Development
```bash
npm run dev              # Start Vite dev server on port 8080
npm run build            # Production build
npm run preview          # Preview production build
```

### Testing
```bash
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Run tests with coverage report
```

### Lambda Deployment
```bash
# Deploy Lambda with shared layer
./scripts/deploy/deploy-lambda-with-layer.sh <function-name>

# Deploy semantic search Lambda
./scripts/deploy/deploy-semantic-search.sh

# Pre-deployment validation
./scripts/deploy/pre-deploy-check.sh
```

### Database Operations
```bash
# Run migration via Lambda
aws lambda invoke \
  --function-name cwf-db-migration \
  --payload '{"sql":"YOUR_SQL_HERE"}' \
  response.json \
  --region us-west-2 \
  --cli-binary-format raw-in-base64-out

# Backfill embeddings
./scripts/backfill/backfill-embeddings-full-context.sh
```

### API Gateway Management
```bash
# Add new endpoint with authorizer
./scripts/add-api-endpoint.sh /api/your-endpoint GET

# Deploy API changes
aws apigateway create-deployment \
  --rest-api-id 0720au267k \
  --stage-name prod \
  --region us-west-2

# Verify authorizers
./scripts/verify/verify-api-authorizers.sh
```

## Environment Configuration

### Frontend Environment Variables
```bash
VITE_API_BASE_URL              # API Gateway base URL (without /api suffix)
VITE_AWS_REGION                # AWS region (us-west-2)
VITE_COGNITO_USER_POOL_ID      # Cognito User Pool ID
VITE_COGNITO_CLIENT_ID         # Cognito App Client ID
VITE_S3_BUCKET_NAME            # S3 bucket for uploads
VITE_AWS_ACCESS_KEY_ID         # AWS access key (TODO: remove, use presigned URLs)
VITE_AWS_SECRET_ACCESS_KEY     # AWS secret key (TODO: remove, use presigned URLs)
```

### Lambda Environment Variables
```bash
DB_HOST                        # RDS endpoint
DB_PORT                        # PostgreSQL port (5432)
DB_NAME                        # Database name
DB_USER                        # Database user
DB_PASSWORD                    # Database password (from Secrets Manager)
BEDROCK_REGION                 # Bedrock service region
```

## Key Dependencies

### Frontend Production Dependencies
- **@aws-sdk/client-bedrock-runtime**: AWS Bedrock API client
- **@aws-sdk/client-s3**: AWS S3 API client
- **aws-amplify**: AWS Cognito authentication
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form management
- **zod**: Schema validation
- **dexie**: IndexedDB wrapper

### Lambda Dependencies
- **pg**: PostgreSQL client
- **@aws-sdk/client-bedrock-runtime**: Bedrock embeddings
- **@aws-sdk/client-s3**: S3 operations

## Build Configuration

### Vite Configuration
- **Port**: 8080
- **Plugins**: React SWC
- **Build Target**: ES2020
- **Source Maps**: Enabled in development

### TypeScript Configuration
- **Target**: ES2020
- **Module**: ESNext
- **Strict Mode**: Enabled
- **JSX**: react-jsx

### Tailwind Configuration
- **Content**: src/**/*.{ts,tsx}
- **Theme**: Extended with custom colors and animations
- **Plugins**: tailwindcss-animate

## Testing Configuration

### Vitest Configuration
- **Environment**: jsdom
- **Setup Files**: src/test-utils/setupTests.ts
- **Coverage**: v8 provider
- **Globals**: Enabled for describe, it, expect

## Version Control
- **Git**: Version control with .gitignore for node_modules, .env files, build artifacts
- **GitHub Actions**: CI/CD workflows for testing, deployment, and verification
