# Supabase to AWS Migration Plan

## Current State Analysis

**Total files with Supabase references: 85**

### 1. Authentication (Priority: HIGH)
**Current:** Supabase Auth
**Target:** AWS Cognito (partially implemented)

**Files using supabase.auth:**
- Authentication patterns: `supabase.auth.getUser()`, `supabase.auth.getSession()`, `supabase.auth.signIn()`, etc.
- Already have Cognito implementation in `useCognitoAuth.tsx`

**Action Items:**
- [ ] Replace all `supabase.auth` calls with Cognito equivalents
- [ ] Update session management across all components
- [ ] Migrate user ID references from Supabase to Cognito IDs

### 2. Database Queries (Priority: HIGH)
**Current:** Supabase PostgREST API
**Target:** AWS RDS + API Gateway (partially implemented)

**Files using supabase.from():**
- Query patterns: `supabase.from('table').select()`, `.insert()`, `.update()`, `.delete()`
- Already have API service in `apiService.ts` and database wrapper in `database.ts`

**Action Items:**
- [ ] Complete API endpoints for all tables
- [ ] Replace all `supabase.from()` calls with `apiService` calls
- [ ] Implement search functionality in API Gateway
- [ ] Add pagination, filtering, and sorting to API

### 3. Real-time Subscriptions (Priority: MEDIUM)
**Current:** Supabase Realtime
**Target:** AWS AppSync or WebSocket API

**Files using subscriptions:**
- `useSessionMonitor.tsx` - mission task changes
- Real-time updates for collaborative features

**Action Items:**
- [ ] Implement WebSocket API or AppSync subscriptions
- [ ] Replace Supabase channels with AWS equivalent
- [ ] Update real-time listeners

### 4. File Storage (Priority: MEDIUM)
**Current:** Supabase Storage
**Target:** AWS S3 (partially implemented)

**Files referencing storage:**
- Image uploads and file attachments
- Already have S3 service in `s3Service.ts`

**Action Items:**
- [ ] Replace Supabase storage URLs with S3 URLs
- [ ] Update file upload components
- [ ] Migrate existing files to S3

## Migration Strategy

### Phase 1: Authentication (Week 1)
1. **Update all auth imports**
   ```typescript
   // Replace
   import { supabase } from '@/integrations/supabase/client'
   // With
   import { useCognitoAuth } from '@/hooks/useCognitoAuth'
   ```

2. **Key files to update:**
   - `src/hooks/useAuth.tsx` - Main auth hook
   - `src/pages/Auth.tsx` - Login/signup page
   - All components using `supabase.auth.getUser()`

### Phase 2: Core Database Operations (Week 2)
1. **Complete API service implementation**
   - Add missing CRUD operations
   - Implement search endpoints
   - Add proper error handling

2. **Update high-traffic components:**
   - `useCombinedAssets.tsx` - Asset management
   - `useGenericIssues.tsx` - Issue tracking
   - `useInventoryAnalytics.tsx` - Analytics

### Phase 3: Remaining Components (Week 3)
1. **Update remaining 60+ components**
   - Replace `supabase.from()` calls
   - Update error handling
   - Test functionality

### Phase 4: Real-time & Storage (Week 4)
1. **Implement WebSocket/AppSync**
2. **Complete S3 migration**
3. **Remove Supabase dependencies**

## Implementation Checklist

### Authentication Migration
- [ ] `src/hooks/useAuth.tsx`
- [ ] `src/pages/Auth.tsx`
- [ ] `src/components/AuthDiagnostics.tsx`
- [ ] All components with `supabase.auth.getUser()`

### Database Migration
- [ ] Complete `apiService.ts` with all endpoints
- [ ] Update `database.ts` wrapper
- [ ] Migrate hooks (30+ files)
- [ ] Migrate components (40+ files)
- [ ] Migrate pages (10+ files)

### Critical Files (Update First)
1. `src/hooks/useCombinedAssets.tsx` - Asset search (current error)
2. `src/hooks/useAuth.tsx` - Authentication
3. `src/hooks/useGenericIssues.tsx` - Issue management
4. `src/lib/database.ts` - Database wrapper
5. `src/lib/apiService.ts` - API client

## Risk Mitigation
1. **Gradual migration** - Update one module at a time
2. **Feature flags** - Toggle between Supabase/AWS during transition
3. **Comprehensive testing** - Test each migrated component
4. **Rollback plan** - Keep Supabase client available during migration

## Success Criteria
- [ ] Zero Supabase imports in codebase
- [ ] All functionality working with AWS services
- [ ] Performance maintained or improved
- [ ] No data loss during migration
- [ ] Real-time features working with AWS
