# Implementation Tasks: CloudFront Image Security (Simplified)

## Zero-Downtime Migration Strategy

**CRITICAL: This implementation keeps the existing S3 public access working until CloudFront is fully verified.**

### Migration Phases:
1. **Phases 1-3**: Build CloudFront infrastructure and thumbnail generation with feature flags OFF
2. **Phase 4**: Test and gradually roll out CloudFront with feature flag (S3 still public as fallback)
3. **Phase 5**: Only after 1 week of stable CloudFront at 100%, make S3 private
4. **Phase 6**: Clean up legacy code

### Key Safety Features:
- **Feature Flag**: `USE_CLOUDFRONT_CDN` controls whether to use CloudFront or S3 URLs
- **Dual-Mode Frontend**: Image service works with both S3 URLs and CloudFront URLs
- **S3 Stays Public**: Direct S3 access works as fallback during rollout
- **Gradual Rollout**: 1-2 users → 10% → 50% → 100% with monitoring at each step
- **Easy Rollback**: Disable feature flag to revert to S3 URLs instantly

---

## Phase 1: Infrastructure Setup

### Task 1: Create CloudFront Key Pair and Store Private Key
- [x] 1.1 Generate CloudFront key pair in AWS Console
- [x] 1.2 Download private key PEM file
- [x] 1.3 Store private key in AWS Systems Manager Parameter Store (name: `/cloudfront/private-key`)
- [x] 1.4 Note the CloudFront Key Pair ID (K2H8GDNHZGWA0K)
- [x] 1.5 Verify key pair is active in CloudFront

### Task 2: Create Origin Access Identity for CloudFront
- [x] 2.1 Create Origin Access Identity in CloudFront Console
- [x] 2.2 Note the OAI ID (E32HS5MSM349PK)
- [x] 2.3 Note the OAI canonical user ID for S3 bucket policy

### Task 3: Prepare S3 Bucket Policy (DO NOT APPLY YET)
- [x] 3.1 Backup current S3 bucket policy
- [x] 3.2 Draft new bucket policy allowing both public read AND CloudFront OAI access
- [x] 3.3 Document the policy change (will be applied in Phase 4 after verification)
- [x] 3.4 Document rollback procedure
- [x] 3.5 **NOTE: Keep existing public access until Phase 4 verification complete**

### Task 4: Create CloudFront Distribution
- [x] 4.1 Create CloudFront distribution with S3 origin (cwf-dev-assets)
- [ ] 4.2 Configure Origin Access Identity for S3 access - **NEEDS MANUAL FIX IN AWS CONSOLE**
- [x] 4.3 Set behavior path pattern: `/organizations/*`
- [x] 4.4 Enable HTTPS only (redirect HTTP to HTTPS)
- [x] 4.5 Configure trusted key groups with CloudFront Key Pair ID
- [x] 4.6 Configure cache policy (CachingOptimized)
- [x] 4.7 Enable compression
- [x] 4.8 Wait for distribution deployment (~15 minutes)
- [x] 4.9 Note CloudFront domain name (d3l6r2sq70ysui.cloudfront.net)

---

## Phase 2: Backend Implementation

### Task 5: Create Cookie Generator Lambda Function
- [x] 5.1 Create Lambda function cwf-image-auth in us-west-2
- [x] 5.2 Implement Cognito token validation logic
- [x] 5.3 Implement organization_id extraction from token claims
- [x] 5.4 Implement CloudFront signed cookie generation
- [x] 5.5 Fetch private key from SSM Parameter Store
- [x] 5.6 Build CloudFront policy with organization-scoped resource path
- [x] 5.7 Sign policy using RSA-SHA1
- [x] 5.8 Return Set-Cookie headers with all three cookies
- [x] 5.9 Configure environment variables (CLOUDFRONT_DOMAIN, KEY_PAIR_ID, etc.)
- [x] 5.10 Add error handling and CloudWatch logging

### Task 6: Create API Gateway Endpoint for Cookie Generation
- [x] 6.1 Add POST /api/images/auth endpoint to API Gateway
- [x] 6.2 Configure Cognito authorizer for endpoint
- [x] 6.3 Integrate with cwf-image-auth Lambda
- [x] 6.4 Configure CORS headers
- [x] 6.5 Deploy API Gateway changes
- [ ] 6.6 Test endpoint with valid Cognito token

### Task 7: Update Upload Path to Organization-Scoped Structure
- [x] 7.1 Update cwf-presigned-upload Lambda to extract organization_id from Cognito token claims
- [x] 7.2 Add feature flag: USE_ORG_SCOPED_KEYS (default: false)
- [x] 7.3 When flag enabled: generate presigned URL for `organizations/{org_id}/images/uploads/{uuid}.{extension}`
- [x] 7.4 When flag disabled: use existing pattern `mission-attachments/uploads/{random}-{filename}`
- [x] 7.5 Generate UUID using crypto.randomUUID() for guaranteed uniqueness (when flag enabled)
- [ ] 7.6 Update cwf-image-compressor Lambda to handle organization-scoped paths:
  - [x] 7.6.1 Detect path pattern (mission-attachments vs organizations)
  - [x] 7.6.2 For mission-attachments: keep existing behavior (mission-attachments/{file}, mission-attachments/thumb/{file}.webp)
  - [x] 7.6.3 For organizations: save compressed to `organizations/{org_id}/images/{uuid}.jpg`
  - [x] 7.6.4 For organizations: save thumbnail to `organizations/{org_id}/images/thumb/{uuid}.webp`
  - [x] 7.6.5 Add CacheControl headers for both compressed and thumbnail uploads
- [x] 7.7 Deploy cwf-presigned-upload Lambda with flag disabled
- [x] 7.8 Deploy cwf-image-compressor Lambda (backward compatible)
- [ ] 7.9 Test upload flow with old key structure (verify no breakage)
- [ ] 7.10 Enable USE_ORG_SCOPED_KEYS flag and test organization-scoped uploads
- [ ] 7.11 Verify compression and thumbnail generation work for both path patterns
---

## Phase 3: Frontend Implementation

### Task 8: Create Image Service Module with Dual-Mode Support
- [ ] 8.1 Create src/lib/imageService.ts
- [ ] 8.2 Implement getImageUrl(s3Key, size) function with mode detection
  - [ ] 8.2.1 size options: 'original', 'preview', 'thumbnail'
  - [ ] 8.2.2 Construct path: `organizations/{org_id}/images/{size}/{uuid}.{ext}`
- [ ] 8.3 Add feature flag: USE_CLOUDFRONT_CDN (default: false)
- [ ] 8.4 When flag disabled: return S3 URLs (existing behavior)
- [ ] 8.5 When flag enabled: return CloudFront URLs
- [ ] 8.6 Implement refreshImageCookies() function (only when CloudFront enabled)
- [ ] 8.7 Implement areCookiesExpiringSoon() function
- [ ] 8.8 Implement clearImageCookies() function
- [ ] 8.9 Add backward compatibility for legacy S3 URLs
- [ ] 8.10 Add environment variable for VITE_CLOUDFRONT_DOMAIN

### Task 9: Create useImage Hook with TanStack Query
- [ ] 9.1 Create src/hooks/useImage.ts
- [ ] 9.2 Implement TanStack Query hook for image fetching
- [ ] 9.3 Configure query to fetch images as Blobs
- [ ] 9.4 Convert Blob to Object URL for display
- [ ] 9.5 Implement automatic cookie refresh on 403 errors
- [ ] 9.6 Configure staleTime: 7 days for thumbnails, 1 day for larger
- [ ] 9.7 Configure gcTime: 30 days
- [ ] 9.8 Set networkMode: 'offlineFirst'
- [ ] 9.9 Add cleanup for Object URLs on unmount

### Task 10: Setup TanStack Query Persistence with IndexedDB
- [ ] 10.1 Install dependencies: @tanstack/react-query-persist-client, idb-keyval
- [ ] 10.2 Create IndexedDB persister in src/lib/queryPersister.ts
- [ ] 10.3 Wrap App with PersistQueryClientProvider
- [ ] 10.4 Configure persister with IndexedDB storage
- [ ] 10.5 Set cache key: 'cwf-image-cache'
- [ ] 10.6 Test persistence by refreshing page and checking cache

### Task 11: Implement Cookie Management in Auth Flow
- [ ] 11.1 Update login flow to request image cookies after Cognito auth
- [ ] 11.2 Store cookie expiration time in memory
- [ ] 11.3 Add automatic cookie refresh check before API calls
- [ ] 11.4 Implement cookie refresh when expiring within 5 minutes
- [ ] 11.5 Clear image cookies on logout

### Task 12: Update Image Components to Use Image Service
- [ ] 12.1 Update UnifiedActionDialog to use getImageUrl helper (respects feature flag)
- [ ] 12.2 Update ExplorationTab to use getImageUrl helper
- [ ] 12.3 Update AssetHistoryDialog to use getImageUrl helper
- [ ] 12.4 Update all other components displaying images
- [ ] 12.5 Use appropriate sizes: 'thumbnail' for lists, 'preview' for dialogs, 'original' for modals
- [ ] 12.6 Add loading states during image fetch
- [ ] 12.7 Add placeholder images for errors
- [ ] 12.8 Test all components with feature flag OFF (verify no breakage)

---

## Phase 4: Gradual Rollout

### Task 13: Gradual Rollout with Feature Flag (Zero Downtime)
- [ ] 13.1 Verify feature flag USE_CLOUDFRONT_CDN exists (default: false)
- [ ] 13.2 Deploy all code with flag disabled (no behavior change)
- [ ] 13.3 Verify existing images still work via S3 URLs
- [ ] 13.4 Enable CloudFront flag for internal testing only (1-2 users)
- [ ] 13.5 Test image viewing, uploading, offline mode
- [ ] 13.6 Monitor for errors and performance issues
- [ ] 13.7 If issues found: disable flag, fix issues, redeploy
- [ ] 13.8 Enable flag for 10% of users (canary deployment)
- [ ] 13.9 Monitor error rates, performance, costs for 24 hours
- [ ] 13.10 If stable: increase to 50% of users
- [ ] 13.11 Monitor for another 24 hours
- [ ] 13.12 If stable: enable for 100% of users
- [ ] 13.13 Monitor for 1 week before proceeding to S3 lockdown
- [ ] 13.14 **CRITICAL: Keep S3 public until this step is 100% verified**

---

## Phase 5: S3 Lockdown (After CloudFront Verified)

### Task 14: Make S3 Bucket Private (ONLY AFTER 100% CloudFront Verified)
- [ ] 14.1 Verify CloudFront has been running at 100% for at least 1 week
- [ ] 14.2 Verify no image loading errors in production
- [ ] 14.3 Verify cache hit rate >95%
- [ ] 14.4 Create rollback plan (re-enable public access if needed)
- [ ] 14.5 Update S3 bucket policy to remove public read access
- [ ] 14.6 Keep CloudFront OAI access only
- [ ] 14.7 Test direct S3 URLs return 403 Forbidden
- [ ] 14.8 Verify CloudFront images still work
- [ ] 14.9 Monitor for 24 hours for any issues

### Task 15: Migrate Existing Images to Thumbnail Structure
- [ ] 15.1 Create migration script to generate thumbnails for existing images
- [ ] 15.2 For each existing image:
  - [ ] 15.2.1 Download original from S3
  - [ ] 15.2.2 Generate thumbnail (200px WebP)
  - [ ] 15.2.3 Generate preview (800px WebP)
  - [ ] 15.2.4 Upload to new paths
- [ ] 15.3 Update database records with new key structure
- [ ] 15.4 Test migrated images
- [ ] 15.5 Keep original images for 30-day grace period
- [ ] 15.6 After 30 days: delete original images if no issues

---

## Phase 6: Cleanup

### Task 16: Remove Legacy Code
- [ ] 16.1 Remove broken cwf-image-compressor Lambda function
- [ ] 16.2 Remove S3 trigger for image compression
- [ ] 16.3 Remove old image URL construction code
- [ ] 16.4 Remove feature flag code after stable rollout (keep for 30 days minimum)
- [ ] 16.5 Clean up unused dependencies
- [ ] 16.6 Update documentation

---

## Success Criteria

- [ ] All images require authentication (no public access)
- [ ] Organization isolation enforced (users can't access other org's images)
- [ ] Page load time <2s for 100 thumbnails (after first load)
- [ ] Cache hit rate >95% after warmup
- [ ] No broken images in production
- [ ] Offline mode works (images load from IndexedDB cache)
- [ ] Thumbnails are ~50KB, previews are ~200KB
