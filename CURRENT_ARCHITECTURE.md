# Current Architecture

## Overview
This application has been **fully migrated from Supabase to AWS infrastructure**. 

## System Components

### Frontend (Port 8080)
- **Technology**: React + TypeScript + Vite
- **Location**: `src/` directory
- **Entry Point**: `src/main.tsx`
- **Key Features**:
  - Uses `apiService` for all data operations
  - AWS Cognito for authentication
  - Offline-first architecture with IndexedDB caching

### Backend API (Port 3001)
- **Technology**: Express.js + Node.js
- **Location**: `api/server.js`
- **Database Connection**: PostgreSQL (local dev on port 54322)
- **Key Features**:
  - RESTful API endpoints
  - Direct SQL queries to PostgreSQL
  - CORS enabled for frontend communication

### Database
- **Development**: Local PostgreSQL (port 54322)
- **Production**: AWS RDS PostgreSQL
- **Schema**: Migrated from Supabase with all original data
- **Key Tables**:
  - `actions` (318 records)
  - `tools` (812 records) 
  - `parts` (856 records)
  - `organization_members`

### Authentication
- **Service**: AWS Cognito
- **Implementation**: `src/hooks/useCognitoAuth.tsx`
- **Features**: User registration, login, session management

### File Storage
- **Service**: AWS S3
- **Bucket**: `cwf-dev-assets`
- **Usage**: Tool images, part images, mission attachments

## Data Flow
1. Frontend makes API calls via `apiService`
2. API server receives requests on port 3001
3. Server executes SQL queries against PostgreSQL
4. Results returned as JSON to frontend
5. Frontend caches data in IndexedDB for offline use

## Development Workflow
1. Start API server: `cd api && npm start`
2. Start frontend: `npm run dev`
3. Access application: http://localhost:8080

## Migration Status
- ✅ Frontend migrated from Supabase client to API service
- ✅ Database migrated to PostgreSQL with all data preserved
- ✅ Authentication migrated to AWS Cognito
- ✅ File storage migrated to AWS S3
- ✅ All 318 actions, 812 tools, 856 parts successfully migrated

## Legacy Components (Ignore)
- `supabase/` directory
- `mock-api-server.mjs` (was temporary during migration)
- Any Supabase-related configuration files
