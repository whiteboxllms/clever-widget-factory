# Clever Widget Factory

## Current Architecture (Post-Migration)

**⚠️ IMPORTANT: We are NO LONGER using Supabase. The application has been migrated to AWS infrastructure.**

### Technology Stack
- **Frontend**: React + TypeScript + Vite (runs on port 8080)
- **Backend API**: Express.js server (runs on port 3001)
- **Database**: PostgreSQL (local development instance on port 54322)
- **Authentication**: AWS Cognito
- **File Storage**: AWS S3
- **Infrastructure**: AWS (RDS for production database)

### Development Setup

1. **Start the API server**:
   ```bash
   cd api
   npm start
   ```
   This starts the Express server on http://localhost:3001

2. **Start the frontend**:
   ```bash
   npm run dev
   ```
   This starts the Vite dev server on http://localhost:8080

### API Endpoints
The API server provides these endpoints:
- `GET /health` - Health check
- `GET /api/actions` - Get all actions
- `GET /api/organization_members` - Get organization members
- `GET /api/tools` - Get tools
- `GET /api/parts` - Get parts
- `POST /api/query` - Execute custom SQL queries

### Database Connection
- **Development**: Local PostgreSQL instance (port 54322)
- **Production**: AWS RDS PostgreSQL instance

### Migration Status
✅ **COMPLETED**: Migrated from Supabase to AWS infrastructure
- Frontend updated to use API service instead of Supabase client
- Database migrated to PostgreSQL
- Authentication moved to AWS Cognito
- File storage moved to AWS S3

### Legacy Files (To Be Removed)
The following files are legacy from the Supabase era and should be ignored:
- `supabase/` directory
- Any files referencing `@supabase/supabase-js`
- `SUPABASE_TO_AWS_MIGRATION_PLAN.md` (migration is complete)
