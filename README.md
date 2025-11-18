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

### Legacy Files (To Be Removed)
The following files are legacy from the Supabase era and should be ignored:
- `supabase/` directory
- Any files referencing `@supabase/supabase-js`
- `SUPABASE_TO_AWS_MIGRATION_PLAN.md` (migration is complete)
