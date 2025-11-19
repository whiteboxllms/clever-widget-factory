# Clever Widget Factory

## Current Architecture (Post-Migration)

**⚠️ IMPORTANT: We are NO LONGER using Supabase. The application has been migrated to AWS infrastructure.**

### Technology Stack
- **Frontend**: React + TypeScript + Vite (runs on port 8080)
- **Backend API**: AWS API Gateway + Lambda
- **Database**: AWS RDS PostgreSQL
- **Authentication**: AWS Cognito
- **File Storage**: AWS S3
- **Infrastructure**: Fully AWS-based

### Development Setup

1. **Start the frontend**:
   ```bash
   npm run dev
   ```
   This starts the Vite dev server on http://localhost:8080

### API Endpoints
The AWS API Gateway provides these endpoints:
- `GET /health` - Health check
- `GET /api/actions` - Get all actions
- `GET /api/organization_members` - Get organization members
- `GET /api/tools` - Get tools
- `GET /api/parts` - Get parts
- `POST /api/query` - Execute custom SQL queries

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

### Legacy Files (To Be Removed)
The following files are legacy from the Supabase era and should be ignored:
- `supabase/` directory
- Any files referencing `@supabase/supabase-js`
- `SUPABASE_TO_AWS_MIGRATION_PLAN.md` (migration is complete)
