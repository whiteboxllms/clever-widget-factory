# Clever Widget Factory

A comprehensive asset management and accountability system built with React, TypeScript, and AWS.

## Current Architecture (Post-Migration)

**⚠️ IMPORTANT: We are NO LONGER using Supabase. The application has been migrated to AWS infrastructure.**

### Technology Stack
- **Frontend**: React + TypeScript + Vite (runs on port 8080)
- **Backend API**: AWS API Gateway + Lambda
- **Database**: AWS RDS PostgreSQL
- **Authentication**: AWS Cognito
- **File Storage**: AWS S3
- **Infrastructure**: Fully AWS-based

## Local Development Setup

### Prerequisites
- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Development Setup

1. **Clone and install**:
   ```bash
   git clone <YOUR_GIT_URL>
   cd clever-widget-factory
   npm i
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```
   This starts the Vite dev server on http://localhost:8080

### API Configuration

**IMPORTANT**: The `VITE_API_BASE_URL` should NOT include the `/api` suffix:
- ✅ Correct: `https://xxx.execute-api.us-west-2.amazonaws.com/prod`
- ❌ Wrong: `https://xxx.execute-api.us-west-2.amazonaws.com/prod/api`

The apiService automatically adds `/api` to all endpoints.

### API Endpoints
The AWS API Gateway provides these endpoints:
- `GET /health` - Health check
- `GET /api/actions` - Get all actions
- `GET /api/organization_members` - Get organization members
- `GET /api/tools` - Get tools
- `GET /api/parts` - Get parts
- `POST /api/query` - Execute custom SQL queries

#### `/api/tools` response
Tools are served by the `cwf-core-lambda` function which queries the AWS RDS instance. Each tool row now includes checkout metadata resolved server-side (no extra checkout request required):
- `is_checked_out` (boolean)
- `checked_out_user_id`
- `checked_out_to`
- `checked_out_date`
- `expected_return_date`
- `checkout_intended_usage`
- `checkout_notes`

When a tool has an active checkout (`is_returned = false` in `checkouts`), `status` is automatically overridden to `checked_out`.

### Database Connection
- **All environments**: AWS RDS PostgreSQL instance

### Database Migrations
Run database migrations using the Lambda function:
```bash
aws lambda invoke --function-name cwf-db-migration --payload '{"sql":"YOUR_SQL_HERE"}' response.json --region us-west-2 --cli-binary-format raw-in-base64-out
```

### Migration Status
✅ **COMPLETED**: Migrated from Supabase to AWS infrastructure
- Frontend updated to use API service instead of Supabase client
- Database migrated to PostgreSQL
- Authentication moved to AWS Cognito
- File storage moved to AWS S3
- Policy agreement system implemented (actions now use `policy_agreed_at`/`policy_agreed_by` fields)

### User ID Migration Reference
During Cognito migration, user IDs were updated. Reference for any remaining migrations:

| User | Old UUID | New Cognito UUID |
|------|----------|------------------|
| Malone | `4d7124f9-c0f2-490d-a765-3a3f8d1dbad8` | `989163e0-7011-70ee-6d93-853674acd43c` |
| Lester Paniel | `7dd4187f-ff2a-4367-9e7b-0c8741f25495` | `68d173b0-60f1-70ea-6084-338e74051fcc` |
| Mae Dela Torre | `48155769-4d22-4d36-9982-095ac9ad6b2c` | `1891f310-c071-705a-2c72-0d0a33c92bf0` |
| Stefan Hamilton | `b8006f2b-0ec7-4107-b05a-b4c6b49541fd` | `08617390-b001-708d-f61e-07a1698282ec` |

## What technologies are used for this project?

This project is built with:

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn-ui, Radix UI, Tailwind CSS
- **Database**: AWS RDS PostgreSQL
- **Authentication**: AWS Cognito
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form with Zod validation
- **Rich Text**: Tiptap editor
- **Image Processing**: Browser Image Compression
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Testing

Run the test suite:
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:ui             # UI mode
npm run test:coverage       # With coverage
```

### Legacy Files (To Be Removed)
The following files are legacy from the Supabase era and should be ignored:
- `supabase/` directory
- Any files referencing `@supabase/supabase-js`
- `SUPABASE_TO_AWS_MIGRATION_PLAN.md` (migration is complete)

### TODO / Known Issues

#### Database Functions & Triggers
- **`get_user_organization_id()` function error**: When creating parts history, error `{error: 'function get_user_organization_id() does not exist'}` occurs. 
  - **Status**: Partially fixed - stub function created but may need verification
  - **Root Cause**: Database triggers on `parts_history` table (or other tables) may be calling this Supabase-era function
  - **Temporary Fix**: Created stub function that returns default org ID (`00000000-0000-0000-0000-000000000001`)
  - **Proper Fix Needed**: 
    1. Find all triggers using `get_user_organization_id()` (see `find-triggers-using-org-id.sql`)
    2. Remove triggers or update them to not use this function
    3. Ensure all Lambda INSERT statements explicitly include `organization_id` from request body
    4. Remove stub function once triggers are cleaned up
  - **Files**: `fix-get-user-org-id.sql`, `find-triggers-using-org-id.sql`
