# Implementation Tasks: CloudFront Image Security and Performance

## Zero-Downtime Migration Strategy

**CRITICAL: This implementation keeps the existing S3 public access working until CloudFront is fully verified.**

### Migration Phases:
1. **Phases 1-3**: Build CloudFront infrastructure and frontend code with feature flags OFF
2. **Phase 4**: Skip database migration initially (frontend handles both URLs and keys)
3. **Phase 5-6**: Test and gradually roll out CloudFront with feature flag (S3 still public as fallback)
4. **Phase 7**: Only after 1 week of stable CloudFront at 100%, make S3 private
5. **Phase 8**: Clean up legacy code and migrate old images

### Key Safety Features:
- **Feature Flag**: `USE_CLOUDFRONT_CDN` controls whether to use CloudFront or S3 URLs
- **Dual-Mode Frontend**: Image service works with both S3 URLs and CloudFront URLs
- **No Database Changes**: Existing image URLs stay unchanged until verified
- **S3 Stays Public**: Direct S3 access works as fallback during rollout
- **Gradual Rollout**: 1-2 users → 10% → 50% → 100% with monitoring at each step
- **Easy Rollback**: Disable feature flag to revert to S3 URLs instantly

### Rollback Plan:
If issues occur at any stage:
1. Set `USE_CLOUDFRONT_CDN=false` in environment variables
2. Redeploy frontend (takes ~2 minutes)
3. All images revert to S3 URLs immediately
4. No data loss, no broken images

---

## Phase 1: Infrastructure Setup

### Task 1: Create CloudFront Key Pair and Store Private Key
- [x] 1.1 Generate CloudFront key pair in AWS Console (CloudFront → Key Management)
- [x] 1.2 Download private key PEM file
- [x] 1.3 Store private key in AWS Systems Manager Parameter Store (name: `/cloudfront/private-key`) - **Changed from Secrets Manager to save $0.40/month**
- [x] 1.4 Note the CloudFront Key Pair ID for Lambda configuration (K2H8GDNHZGWA0K)
- [x] 1.5 Verify key pair is active in CloudFront

### Task 2: Create Origin Access Identity for CloudFront
- [x] 2.1 Create Origin Access Identity in CloudFront Console
- [x] 2.2 Note the OAI ID (E32HS5MSM349PK)
- [x] 2.3 Note the OAI canonical user ID for S3 bucket policy

### Task 3: Prepare S3 Bucket Policy (DO NOT APPLY YET)
- [x] 3.1 Backup current S3 bucket policy
- [x] 3.2 Draft new bucket policy allowing both public read AND CloudFront OAI access
- [x] 3.3 Document the policy change (will be applied in Phase 6 after verification)
- [x] 3.4 Document rollback procedure
- [x] 3.5 **NOTE: Keep existing public access until Phase 6 verification complete**

### Task 4: Deploy Lambda@Edge Image Resizer Function (OPTIONAL - DEFERRED)
- [x] 4.1 Create Lambda function in us-east-1 region (Lambda@Edge requirement)
- [ ] 4.2 Install Sharp library compiled for Lambda environment
- [ ] 4.3 Implement image resizing logic with query parameter parsing
- [ ] 4.4 Configure function: 512MB memory, 5s timeout
- [ ] 4.5 Grant S3 read permissions to Lambda execution role
- [ ] 4.6 Publish Lambda version (Lambda@Edge requires versioned functions)
- [ ] 4.7 Test function with sample images and resize parameters
- [ ] **NOTE: This is optional and can be added later. Not required for basic signed cookie functionality.**

### Task 5: Create CloudFront Distribution
- [x] 5.1 Create CloudFront distribution with S3 origin (cwf-dev-assets)
- [ ] 5.2 Configure Origin Access Identity for S3 access - **NEEDS MANUAL FIX IN AWS CONSOLE**
- [x] 5.3 Set behavior path pattern: `/organizations/*`
- [x] 5.4 Enable HTTPS only (redirect HTTP to HTTPS)
- [x] 5.5 Configure trusted key groups with CloudFront Key Pair ID
- [ ] 5.6 Attach Lambda@Edge function to origin-request event (OPTIONAL - deferred)
- [x] 5.7 Configure cache policy (CachingOptimized)
- [x] 5.8 Set cache TTL via cache policy
- [x] 5.9 Enable compression
- [ ] 5.10 Add security headers policy (can add later)
- [x] 5.11 Wait for distribution deployment (~15 minutes)
- [x] 5.12 Note CloudFront domain name (d3l6r2sq70ysui.cloudfront.net)

## Phase 2: Backend Implementation

### Task 6: Create Cookie Generator Lambda Function
- [x] 6.1 Create Lambda function cwf-image-auth in us-west-2
- [x] 6.2 Implement Cognito token validation logic
- [x] 6.3 Implement organization_id extraction from token claims
- [x] 6.4 Implement CloudFront signed cookie generation
- [x] 6.5 Fetch private key from SSM Parameter Store (changed from Secrets Manager)
- [x] 6.6 Build CloudFront policy with organization-scoped resource path
- [x] 6.7 Sign policy using RSA-SHA1
- [x] 6.8 Return Set-Cookie headers with all three cookies
- [x] 6.9 Configure environment variables (CLOUDFRONT_DOMAIN, KEY_PAIR_ID, etc.)
- [x] 6.10 Add error handling for missing org_id, signing failures
- [x] 6.11 Add CloudWatch logging for all requests
- [x] 6.12 Write unit tests for cookie generation logic (tests exist, need to update for SSM)

### Task 7: Create API Gateway Endpoint for Cookie Generation
- [x] 7.1 Add POST /api/images/auth endpoint to API Gateway
- [x] 7.2 Configure Cognito authorizer for endpoint
- [x] 7.3 Integrate with cwf-image-auth Lambda
- [x] 7.4 Configure CORS headers
- [x] 7.5 Deploy API Gateway changes
- [ ] 7.6 Test endpoint with valid Cognito token (requires user login)
- [ ] 7.7 Verify cookies are set in response headers (requires user login)

### Task 8: Update Presigned Upload Lambda for UUID-Based Keys
- [ ] 8.1 Update cwf-presigned-upload Lambda code
- [ ] 8.2 Extract organization_id from Cognito token claims
- [ ] 8.3 Add feature flag: USE_ORG_SCOPED_KEYS (default: false)
- [ ] 8.4 When flag enabled: use pattern `organizations/{org_id}/images/{uuid}.{extension}`
- [ ] 8.5 When flag disabled: use old pattern `mission-attachments/uploads/{timestamp}-{random}-{filename}`
- [ ] 8.6 Generate UUID using crypto.randomUUID() for guaranteed uniqueness
- [ ] 8.7 Preserve original filename in database metadata (not in S3 key)
- [ ] 8.8 Return both S3 key and full URL for backward compatibility
- [ ] 8.9 Add validation for organization_id presence
- [ ] 8.10 Deploy updated Lambda with flag disabled
- [ ] 8.11 Test upload flow with old key structure (verify no breakage)
- [ ] 8.12 Write unit tests for key generation logic
- [ ] 8.13 Document new path structure: organizations/{org_id}/images/{uuid}.{ext}

## Phase 3: Frontend Implementation

### Task 9: Create Image Service Module with Dual-Mode Support
- [ ] 9.1 Create src/lib/imageService.ts
- [ ] 9.2 Implement getImageUrl(s3Key, options) function with mode detection
- [ ] 9.3 Add feature flag: USE_CLOUDFRONT_CDN (default: false)
- [ ] 9.4 When flag disabled: return S3 URLs (existing behavior)
- [ ] 9.5 When flag enabled: return CloudFront URLs with getCloudFrontUrl()
- [ ] 9.6 Implement refreshImageCookies() function (only when CloudFront enabled)
- [ ] 9.7 Implement areCookiesExpiringSoon() function
- [ ] 9.8 Implement clearImageCookies() function
- [ ] 9.9 Add backward compatibility for legacy S3 URLs
- [ ] 9.10 Add environment variable for VITE_CLOUDFRONT_DOMAIN
- [ ] 9.11 Write unit tests for URL construction in both modes
- [ ] 9.12 Write property tests for URL construction (Property 11, 12, 13)

### Task 10: Create useImage Hook with TanStack Query
- [ ] 10.1 Create src/hooks/useImage.ts
- [ ] 10.2 Implement TanStack Query hook for image fetching
- [ ] 10.3 Configure query to fetch images as Blobs
- [ ] 10.4 Convert Blob to Object URL for display
- [ ] 10.5 Implement automatic cookie refresh on 403 errors
- [ ] 10.6 Configure staleTime: 7 days for thumbnails, 1 day for larger
- [ ] 10.7 Configure gcTime: 30 days
- [ ] 10.8 Set networkMode: 'offlineFirst'
- [ ] 10.9 Add cleanup for Object URLs on unmount
- [ ] 10.10 Write unit tests for hook behavior
- [ ] 10.11 Write property tests for cache-first behavior (Property 14, 15, 16)

### Task 11: Setup TanStack Query Persistence with IndexedDB
- [ ] 11.1 Install dependencies: @tanstack/react-query-persist-client, idb-keyval
- [ ] 11.2 Create IndexedDB persister in src/lib/queryPersister.ts
- [ ] 11.3 Wrap App with PersistQueryClientProvider
- [ ] 11.4 Configure persister with IndexedDB storage
- [ ] 11.5 Set cache key: 'cwf-image-cache'
- [ ] 11.6 Test persistence by refreshing page and checking cache
- [ ] 11.7 Add cache size monitoring and eviction logic

### Task 12: Implement Cookie Management in Auth Flow
- [ ] 12.1 Update login flow to request image cookies after Cognito auth
- [ ] 12.2 Store cookie expiration time in memory
- [ ] 12.3 Add automatic cookie refresh check before API calls
- [ ] 12.4 Implement cookie refresh when expiring within 5 minutes
- [ ] 12.5 Clear image cookies on logout
- [ ] 12.6 Add error handling for cookie refresh failures
- [ ] 12.7 Write unit tests for cookie lifecycle

### Task 13: Update Image Components to Use Dual-Mode Image Service
- [ ] 13.1 Update UnifiedActionDialog to use getImageUrl helper (respects feature flag)
- [ ] 13.2 Update ExplorationTab to use getImageUrl helper
- [ ] 13.3 Update AssetHistoryDialog to use getImageUrl helper
- [ ] 13.4 Update all other components displaying images
- [ ] 13.5 Ensure components work with both S3 URLs (flag off) and CloudFront URLs (flag on)
- [ ] 13.6 Use appropriate sizes: 200px thumbnails, 800px previews, full-size modals
- [ ] 13.7 Set quality: 75 for thumbnails, 85 for previews
- [ ] 13.8 Set format: webp for thumbnails and previews
- [ ] 13.9 Add loading states during image fetch
- [ ] 13.10 Add placeholder images for errors
- [ ] 13.11 Add offline indicator when serving from cache (CloudFront mode only)
- [ ] 13.12 Test all components with feature flag OFF (verify no breakage)
- [ ] 13.13 Test all components with feature flag ON (verify CloudFront works)

## Phase 4: Database Migration (Non-Breaking)

### Task 14: Create Database Migration Script for URL to Key Conversion (Optional)
- [ ] 14.1 Create SQL script to extract S3 keys from full URLs
- [ ] 14.2 **NOTE: This is optional - frontend can handle both URLs and keys**
- [ ] 14.3 If migrating: Update state_photos.photo_url to store keys only
- [ ] 14.4 If migrating: Update parts.image_url to store keys only
- [ ] 14.5 If migrating: Update tools.image_url to store keys only
- [ ] 14.6 If migrating: Update issues.report_photo_urls JSONB array to store keys only
- [ ] 14.7 Test migration script on copy of production data
- [ ] 14.8 Verify all URLs converted correctly
- [ ] 14.9 Create rollback script
- [ ] 14.10 **DECISION: Defer this until CloudFront is verified working**

### Task 15: Skip Database Migration Initially
- [ ] 15.1 Keep existing database URLs unchanged
- [ ] 15.2 Frontend getImageUrl() handles both full URLs and keys
- [ ] 15.3 New uploads will use new key structure (when flag enabled)
- [ ] 15.4 Old images continue to work via S3 public access
- [ ] 15.5 Database migration can be done later after CloudFront verification

### Task 16: Create S3 Image Migration Script (For Later Use)
- [ ] 16.1 Create Node.js script to migrate S3 images to organization-scoped keys
- [ ] 16.2 Query database to get all image keys and associated organization_ids
- [ ] 16.3 For each image, copy to new key: `organizations/{org_id}/images/{filename}`
- [ ] 16.4 Update database records with new keys
- [ ] 16.5 Preserve original image metadata (content-type, timestamps)
- [ ] 16.6 Test script on subset of images
- [ ] 16.7 **NOTE: Do not run this script until Phase 6 verification complete**
- [ ] 16.8 Document script usage for future execution

## Phase 5: Testing and Validation

### Task 17: Write Property-Based Tests for Cookie Generation
- [ ] 17.1 Install fast-check library
- [ ] 17.2 Write Property 1: Valid authentication produces complete signed cookies
- [ ] 17.3 Write Property 2: Cookie policy restricts access to organization path
- [ ] 17.4 Write Property 3: Invalid authentication is rejected
- [ ] 17.5 Configure 100 iterations per test
- [ ] 17.6 Run tests and verify all pass

### Task 18: Write Property-Based Tests for S3 Key Generation
- [ ] 18.1 Write Property 4: Upload keys follow organization-scoped pattern
- [ ] 18.2 Write Property 5: Database stores keys not URLs
- [ ] 18.3 Run tests and verify all pass

### Task 19: Write Property-Based Tests for Image Resizing
- [ ] 19.1 Write Property 6: Resize maintains aspect ratio
- [ ] 19.2 Write Property 7: Format conversion produces correct output format
- [ ] 19.3 Write Property 8: Quality parameter affects compression
- [ ] 19.4 Write Property 9: Supported input formats are processed successfully
- [ ] 19.5 Write Property 10: Thumbnail size optimization
- [ ] 19.6 Run tests with sample images and verify all pass

### Task 20: Write Property-Based Tests for URL Construction
- [ ] 20.1 Write Property 11: CloudFront URL construction from S3 keys
- [ ] 20.2 Write Property 12: Resize options appear in query string
- [ ] 20.3 Write Property 13: Backward compatibility with legacy URLs
- [ ] 20.4 Run tests and verify all pass

### Task 21: Write Property-Based Tests for Caching and Offline
- [ ] 21.1 Write Property 14: Cache-first image serving
- [ ] 21.2 Write Property 15: Offline image availability
- [ ] 21.3 Write Property 16: Blob storage in cache
- [ ] 21.4 Run tests and verify all pass

### Task 22: Write Property-Based Tests for Error Handling
- [ ] 22.1 Write Property 17: Cookie refresh on 403 errors
- [ ] 22.2 Write Property 18: Placeholder on error
- [ ] 22.3 Write Property 19: Error logging
- [ ] 22.4 Run tests and verify all pass

### Task 23: Write Property-Based Tests for Security
- [ ] 23.1 Write Property 20: Direct S3 access is denied
- [ ] 23.2 Write Property 21: Cross-organization access is denied
- [ ] 23.3 Write Property 22: Expired cookies are rejected
- [ ] 23.4 Run tests and verify all pass

### Task 24: Integration Testing
- [ ] 24.1 Test end-to-end flow: authenticate → get cookies → fetch image
- [ ] 24.2 Test upload flow: generate presigned URL → upload → verify key in DB
- [ ] 24.3 Test migration: old URL → extract key → fetch via CloudFront
- [ ] 24.4 Test offline mode: disconnect network → verify images load from cache
- [ ] 24.5 Test cookie expiration: wait for expiration → verify auto-refresh
- [ ] 24.6 Test cross-org access: attempt to access another org's images → verify 403
- [ ] 24.7 Test direct S3 access: attempt to access S3 URL → verify 403
- [ ] 24.8 Test image resizing: request different sizes → verify correct dimensions
- [ ] 24.9 Test format conversion: request WebP → verify WebP output
- [ ] 24.10 Test error handling: invalid S3 key → verify placeholder displayed

### Task 25: Performance Testing
- [ ] 25.1 Measure first-time thumbnail load (target: <2s)
- [ ] 25.2 Measure cached thumbnail load (target: <100ms)
- [ ] 25.3 Measure page load with 100 thumbnails (target: <2s after first load)
- [ ] 25.4 Test from different geographic locations (verify edge caching)
- [ ] 25.5 Measure CloudFront cache hit ratio (target: >95% after warmup)
- [ ] 25.6 Test Lambda@Edge processing time (target: <2s for resize)
- [ ] 25.7 Test offline load time (target: <10ms from IndexedDB)

### Task 26: Security Audit
- [ ] 26.1 Verify S3 bucket is private (no public access)
- [ ] 26.2 Verify direct S3 URLs return 403
- [ ] 26.3 Verify expired cookies are rejected by CloudFront
- [ ] 26.4 Verify cross-org access is denied
- [ ] 26.5 Verify cookie policies restrict access to correct org paths
- [ ] 26.6 Verify all image URLs use HTTPS only
- [ ] 26.7 Test with security scanning tools (OWASP ZAP, etc.)
- [ ] 26.8 Document security model and threat mitigations

## Phase 6: Monitoring and Deployment

### Task 27: Setup CloudWatch Monitoring
- [ ] 27.1 Create CloudWatch dashboard for image delivery metrics
- [ ] 27.2 Add metric: Cookie generation success/failure rate
- [ ] 27.3 Add metric: Image resize processing time (p50, p95, p99)
- [ ] 27.4 Add metric: CloudFront cache hit ratio
- [ ] 27.5 Add metric: 403 error rate
- [ ] 27.6 Add metric: Lambda@Edge error rate
- [ ] 27.7 Add metric: Average image load time by size category

### Task 28: Setup CloudWatch Alarms
- [ ] 28.1 Create alarm: 403 error rate >5% for 5 minutes
- [ ] 28.2 Create alarm: Cookie generation failure rate >10%
- [ ] 28.3 Create alarm: Lambda@Edge error rate >5%
- [ ] 28.4 Create alarm: Average resize time >3s
- [ ] 28.5 Configure SNS topic for alarm notifications
- [ ] 28.6 Test alarms by triggering conditions

### Task 29: Cost Monitoring Setup
- [ ] 29.1 Enable AWS Cost Explorer for CloudFront costs
- [ ] 29.2 Create cost budget: <$10/month for 10 users
- [ ] 29.3 Create cost alert: notify if exceeds $15/month
- [ ] 29.4 Monitor costs for first week
- [ ] 29.5 Verify cost reduction vs. S3-only architecture (target: 90%+)
- [ ] 29.6 Document actual costs vs. projections

### Task 30: Gradual Rollout with Feature Flag (Zero Downtime)
- [ ] 30.1 Verify feature flag USE_CLOUDFRONT_CDN exists (default: false)
- [ ] 30.2 Deploy all code with flag disabled (no behavior change)
- [ ] 30.3 Verify existing images still work via S3 URLs
- [ ] 30.4 Enable CloudFront flag for internal testing only (1-2 users)
- [ ] 30.5 Test image viewing, uploading, offline mode
- [ ] 30.6 Monitor for errors and performance issues
- [ ] 30.7 If issues found: disable flag, fix issues, redeploy
- [ ] 30.8 Enable flag for 10% of users (canary deployment)
- [ ] 30.9 Monitor error rates, performance, costs for 24 hours
- [ ] 30.10 If stable: increase to 50% of users
- [ ] 30.11 Monitor for another 24 hours
- [ ] 30.12 If stable: enable for 100% of users
- [ ] 30.13 Monitor for 1 week before proceeding to S3 lockdown
- [ ] 30.14 **CRITICAL: Keep S3 public until this step is 100% verified**

### Task 31: Documentation
- [ ] 31.1 Document CloudFront distribution configuration
- [ ] 31.2 Document Lambda@Edge function deployment process
- [ ] 31.3 Document cookie generation flow
- [ ] 31.4 Document S3 key structure and organization scoping
- [ ] 31.5 Document frontend image usage (useImage hook, getCloudFrontUrl)
- [ ] 31.6 Document offline-first caching strategy
- [ ] 31.7 Document troubleshooting guide (common errors, solutions)
- [ ] 31.8 Document rollback procedure
- [ ] 31.9 Update ENGINEERING_GUIDE.md with image delivery architecture
- [ ] 31.10 Update README.md with new environment variables

## Phase 7: S3 Lockdown (After CloudFront Verified)

### Task 32: Make S3 Bucket Private (ONLY AFTER 100% CloudFront Verified)
- [ ] 32.1 Verify CloudFront has been running at 100% for at least 1 week
- [ ] 32.2 Verify no image loading errors in production
- [ ] 32.3 Verify cache hit rate >95%
- [ ] 32.4 Verify costs are as expected
- [ ] 32.5 Create rollback plan (re-enable public access if needed)
- [ ] 32.6 Update S3 bucket policy to remove public read access
- [ ] 32.7 Keep CloudFront OAI access only
- [ ] 32.8 Test direct S3 URLs return 403 Forbidden
- [ ] 32.9 Verify CloudFront images still work
- [ ] 32.10 Monitor for 24 hours for any issues
- [ ] 32.11 If issues: rollback to public access immediately

### Task 33: Migrate Existing Images to Organization-Scoped Keys (Optional)
- [ ] 33.1 Verify S3 is private and CloudFront is stable
- [ ] 33.2 Run S3 image migration script (from Task 16)
- [ ] 33.3 Migrate images to new organization-scoped structure:
  - [ ] 33.3.1 `mission-attachments/*` → `organizations/{org_id}/actions/*`
  - [ ] 33.3.2 `mission-evidence/*` → `organizations/{org_id}/actions/*`
  - [ ] 33.3.3 `tool-images/parts/*` → `organizations/{org_id}/parts/*`
  - [ ] 33.3.4 `tool-images/tools/*` → `organizations/{org_id}/tools/*`
  - [ ] 33.3.5 `tool-resolution-photos/*` → `organizations/{org_id}/resolutions/*`
- [ ] 33.4 Update database records with new keys
- [ ] 33.5 Verify all images accessible via CloudFront
- [ ] 33.6 Keep original images for 30-day grace period
- [ ] 33.7 Monitor for broken images
- [ ] 33.8 After 30 days: delete original images if no issues
- [ ] 33.9 Document final path structure in ENGINEERING_GUIDE.md

## Phase 8: Cleanup

### Task 34: Remove Legacy Code
- [ ] 34.1 Remove broken cwf-image-compressor Lambda function
- [ ] 34.2 Remove S3 trigger for image compression
- [ ] 34.3 Remove old image URL construction code
- [ ] 34.4 Remove feature flag code after stable rollout (keep for 30 days minimum)
- [ ] 34.5 Clean up unused dependencies

### Task 35: Delete Original S3 Images (After 30-Day Grace Period)
- [ ] 35.1 Verify all images migrated successfully
- [ ] 35.2 Verify no broken images in production
- [ ] 35.3 Create script to delete original images (non-org-scoped keys)
- [ ] 35.4 Run deletion script
- [ ] 35.5 Verify S3 storage costs reduced
- [ ] 35.6 Document final storage structure

## Success Criteria

- [ ] All images require authentication (no public access)
- [ ] Organization isolation enforced (users can't access other org's images)
- [ ] 93% cost reduction achieved ($3.60 → $0.27/month for 5k views)
- [ ] Page load time <2s for 100 thumbnails (after first load)
- [ ] Cache hit rate >95% after warmup
- [ ] No broken images in production
- [ ] Offline mode works (images load from IndexedDB cache)
- [ ] All 22 property-based tests passing
- [ ] Security audit passed
- [ ] Documentation complete
