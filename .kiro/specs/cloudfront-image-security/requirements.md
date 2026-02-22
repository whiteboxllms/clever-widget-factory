# Requirements Document: CloudFront Image Security and Performance

## Introduction

This document specifies requirements for migrating the Clever Widget Factory image delivery system from public S3 access to a secure, performant architecture using CloudFront with Lambda@Edge. The current system serves images directly from a public S3 bucket with no authentication, creating security vulnerabilities and performance limitations. The target architecture implements signed cookie authentication, organization-scoped storage, on-demand image resizing, and global edge caching.

## Glossary

- **CloudFront**: AWS content delivery network (CDN) service that caches content at edge locations globally
- **Lambda@Edge**: AWS Lambda functions that run at CloudFront edge locations for request/response processing
- **Signed_Cookie**: Authentication token stored in browser cookies that CloudFront validates before serving content
- **Origin_Access_Identity**: CloudFront identity that allows access to private S3 buckets
- **Edge_Location**: Geographic location where CloudFront caches content (15-50ms latency)
- **Organization_Scoped_Key**: S3 object key that includes organization ID for multi-tenant isolation
- **Image_Resizer**: Lambda@Edge function that generates thumbnails on-demand using Sharp library
- **Cookie_Generator**: Lambda function that creates signed cookies after validating user authentication
- **CWF_API**: Clever Widget Factory API Gateway with Cognito authentication
- **S3_Bucket**: AWS S3 storage bucket (cwf-dev-assets)
- **Presigned_URL_Lambda**: Existing Lambda function (cwf-presigned-upload) that generates S3 upload URLs
- **TanStack_Query_Persister**: TanStack Query plugin that persists cache to IndexedDB for offline access
- **Image_Cache**: TanStack Query cache storing image blobs with metadata

## Requirements

### Requirement 1: Private S3 Bucket Configuration

**User Story:** As a system administrator, I want the S3 bucket to be private, so that images cannot be accessed without proper authentication.

#### Acceptance Criteria

1. THE System SHALL remove all public read policies from the S3_Bucket
2. THE System SHALL configure an Origin_Access_Identity for CloudFront to access the S3_Bucket
3. THE System SHALL deny direct S3 URL access for all users except CloudFront
4. WHEN a user attempts to access an S3 URL directly, THEN the System SHALL return a 403 Forbidden error

### Requirement 2: Signed Cookie Authentication

**User Story:** As a security engineer, I want image access to require authentication, so that only authorized users can view organization images.

#### Acceptance Criteria

1. THE Cookie_Generator SHALL validate the user's Cognito authentication token
2. THE Cookie_Generator SHALL verify the user belongs to the requested organization
3. WHEN authentication is valid, THEN the Cookie_Generator SHALL create a Signed_Cookie with CloudFront policy
4. THE Signed_Cookie SHALL include the organization_id in the CloudFront custom policy resource path
5. THE Signed_Cookie SHALL expire after a configurable duration (default 1 hour)
6. THE CloudFront SHALL validate the Signed_Cookie before serving any image
7. WHEN a Signed_Cookie is invalid or expired, THEN CloudFront SHALL return a 403 Forbidden error

### Requirement 3: Organization-Scoped Storage

**User Story:** As a security engineer, I want images stored with organization context, so that multi-tenant data isolation is enforced at the storage level.

#### Acceptance Criteria

1. THE System SHALL use the S3 key pattern: `organizations/{org_id}/images/{timestamp}-{random}-{filename}`
2. THE Presigned_URL_Lambda SHALL include organization_id when generating upload URLs
3. THE Signed_Cookie SHALL restrict access to paths matching the user's organization_id
4. WHEN a user attempts to access another organization's images, THEN CloudFront SHALL deny access based on cookie policy

### Requirement 4: CloudFront Distribution Deployment

**User Story:** As a DevOps engineer, I want CloudFront configured with Lambda@Edge, so that images are delivered securely and performantly from edge locations.

#### Acceptance Criteria

1. THE System SHALL create a CloudFront distribution with the S3_Bucket as origin
2. THE CloudFront SHALL use Origin_Access_Identity for S3 access
3. THE CloudFront SHALL attach the Image_Resizer Lambda@Edge function to origin-request events
4. THE CloudFront SHALL require Signed_Cookie validation for all requests
5. THE CloudFront SHALL cache images at Edge_Locations with appropriate TTL (default 24 hours)
6. THE CloudFront SHALL support HTTPS only (no HTTP access)

### Requirement 5: On-Demand Image Resizing

**User Story:** As a frontend developer, I want to request different image sizes via query parameters, so that I can load thumbnails quickly without pre-processing.

#### Acceptance Criteria

1. THE Image_Resizer SHALL accept query parameters: width, height, quality, format
2. WHEN width or height is specified, THEN the Image_Resizer SHALL resize the image maintaining aspect ratio
3. WHEN quality is specified (1-100), THEN the Image_Resizer SHALL compress the image to that quality level
4. WHEN format is specified (jpeg, png, webp), THEN the Image_Resizer SHALL convert the image to that format
5. THE Image_Resizer SHALL default to WebP format for thumbnails to minimize bandwidth costs
6. THE Image_Resizer SHALL support source formats: JPEG, PNG, WebP, HEIC, PDF
7. THE Image_Resizer SHALL cache resized images at Edge_Locations
8. WHEN no resize parameters are provided, THEN the Image_Resizer SHALL serve the original image
9. THE Image_Resizer SHALL return resized images within 2 seconds for uncached requests
10. THE Image_Resizer SHALL optimize thumbnails to target 50-100KB file size for mobile devices
11. THE Image_Resizer SHALL use the Sharp library for image processing

### Requirement 6: Cookie Generation API Endpoint

**User Story:** As a frontend developer, I want an API endpoint to request signed cookies, so that the browser can authenticate image requests.

#### Acceptance Criteria

1. THE CWF_API SHALL expose a POST endpoint `/api/images/auth` for cookie requests
2. THE Cookie_Generator SHALL extract the Cognito user token from the Authorization header
3. THE Cookie_Generator SHALL extract organization_id from the Cognito token claims
4. WHEN authentication succeeds, THEN the Cookie_Generator SHALL return Set-Cookie headers with CloudFront signed cookies
5. THE Cookie_Generator SHALL return three cookies: CloudFront-Policy, CloudFront-Signature, CloudFront-Key-Pair-Id
6. THE Cookie_Generator SHALL set cookie attributes: HttpOnly, Secure, SameSite=Strict, Domain matching CloudFront
7. WHEN authentication fails, THEN the Cookie_Generator SHALL return 401 Unauthorized

### Requirement 7: Image Migration to Organization-Scoped Keys

**User Story:** As a system administrator, I want existing images migrated to organization-scoped keys, so that all images follow the new security model.

#### Acceptance Criteria

1. THE Migration_Script SHALL identify all existing images in the S3_Bucket
2. THE Migration_Script SHALL determine the organization_id for each image from database records
3. THE Migration_Script SHALL copy each image to the new Organization_Scoped_Key pattern
4. THE Migration_Script SHALL update database records with new S3 keys
5. THE Migration_Script SHALL preserve original image metadata (content-type, timestamps)
6. THE Migration_Script SHALL maintain the original images until migration is verified
7. WHEN migration is complete and verified, THEN the Migration_Script SHALL delete original images

### Requirement 8: Database Schema Updates

**User Story:** As a database administrator, I want image URL fields updated to store S3 keys instead of full URLs, so that the system can construct CloudFront URLs dynamically.

#### Acceptance Criteria

1. THE System SHALL update state_photos.photo_url to store S3 keys only
2. THE System SHALL update parts.image_url to store S3 keys only
3. THE System SHALL update tools.image_url to store S3 keys only
4. THE System SHALL update issues.report_photo_urls to store S3 keys only
5. WHEN storing new images, THEN the System SHALL store only the S3 key (not full URL)
6. THE System SHALL provide a migration script to convert existing full URLs to S3 keys

### Requirement 9: Frontend Cookie Management

**User Story:** As a frontend developer, I want automatic cookie management, so that image requests are authenticated without manual intervention.

#### Acceptance Criteria

1. WHEN a user authenticates with Cognito, THEN the Frontend SHALL request signed cookies from `/api/images/auth`
2. THE Frontend SHALL store the cookie expiration time in memory
3. WHEN cookies expire within 5 minutes, THEN the Frontend SHALL automatically refresh cookies
4. WHEN cookie refresh fails, THEN the Frontend SHALL redirect to login
5. THE Frontend SHALL include cookies automatically in all CloudFront image requests
6. WHEN the user logs out, THEN the Frontend SHALL clear image authentication cookies

### Requirement 10: CloudFront URL Construction

**User Story:** As a frontend developer, I want a helper function to construct CloudFront URLs, so that I can easily request different image sizes.

#### Acceptance Criteria

1. THE Frontend SHALL provide a `getImageUrl(s3Key, options)` helper function
2. THE Helper SHALL construct CloudFront URLs from S3 keys
3. THE Helper SHALL accept options: width, height, quality, format
4. THE Helper SHALL append query parameters for resize options
5. WHEN s3Key is null or undefined, THEN the Helper SHALL return a placeholder image URL
6. THE Helper SHALL validate that s3Key does not contain full URLs (only keys)

### Requirement 11: Frontend Component Updates

**User Story:** As a frontend developer, I want all image components updated to use CloudFront URLs, so that images are served securely and performantly.

#### Acceptance Criteria

1. THE Frontend SHALL update all components that display images to use the `getImageUrl` helper
2. THE Frontend SHALL request thumbnail sizes optimized for mobile (width=200, quality=75, format=webp) for list views
3. THE Frontend SHALL request preview sizes (width=800, quality=85, format=webp) for modal views
4. THE Frontend SHALL request full-size images only when explicitly needed
5. THE Frontend SHALL target 50-100KB file size for mobile thumbnails
6. THE Frontend SHALL handle loading states during image fetch
7. WHEN CloudFront returns 403, THEN the Frontend SHALL attempt cookie refresh and retry once

### Requirement 12: Upload Flow Updates

**User Story:** As a user, I want image uploads to work seamlessly with the new architecture, so that my workflow is unchanged.

#### Acceptance Criteria

1. THE Presigned_URL_Lambda SHALL generate presigned URLs with Organization_Scoped_Key pattern
2. THE Presigned_URL_Lambda SHALL extract organization_id from the Cognito token
3. THE Presigned_URL_Lambda SHALL return the S3 key (not full URL) to the frontend
4. THE Frontend SHALL store only the S3 key in the database after upload
5. THE Upload_Flow SHALL maintain existing UX (no user-facing changes)

### Requirement 13: Backward Compatibility During Migration

**User Story:** As a system administrator, I want zero downtime during migration, so that users can continue working without interruption.

#### Acceptance Criteria

1. WHILE migration is in progress, THE System SHALL support both old S3 URLs and new S3 keys
2. THE Frontend SHALL detect URL format (full URL vs key) and handle appropriately
3. WHEN an old S3 URL is detected, THEN the Frontend SHALL extract the key and use CloudFront
4. THE System SHALL maintain a feature flag to control CloudFront vs S3 direct access
5. WHEN the feature flag is disabled, THEN the System SHALL fall back to direct S3 URLs

### Requirement 14: Performance Requirements

**User Story:** As a user, I want images to load quickly, so that I can work efficiently without waiting.

#### Acceptance Criteria

1. WHEN an image is cached at an Edge_Location, THEN CloudFront SHALL serve it within 100ms
2. WHEN an image is not cached, THEN the Image_Resizer SHALL process and return it within 2 seconds
3. THE System SHALL achieve 15-50ms latency from the nearest Edge_Location for cached content
4. WHEN loading 100 thumbnails, THEN the page SHALL complete loading within 2 seconds (after first request)
5. THE CloudFront SHALL cache resized images for 24 hours by default

### Requirement 15: Cost Requirements

**User Story:** As a finance manager, I want reduced infrastructure costs, so that the system is economically sustainable for small teams.

#### Acceptance Criteria

1. THE System SHALL achieve total monthly cost less than $10 for 10 active users
2. THE System SHALL achieve less than $0.50/month cost for 5,000 image views
3. THE System SHALL achieve less than $3.00/month cost for 100,000 image views
4. THE System SHALL reduce costs by at least 90% compared to current S3-only architecture
5. THE System SHALL optimize thumbnail sizes for mobile devices (target 50-100KB per thumbnail)
6. THE System SHALL use WebP format by default for thumbnails to reduce bandwidth costs
7. THE System SHALL monitor CloudFront costs via AWS Cost Explorer
8. THE System SHALL set appropriate cache TTLs to maximize cache hit ratio and minimize origin requests

### Requirement 16: Error Handling and Fallbacks

**User Story:** As a user, I want graceful error handling, so that temporary failures don't break my workflow.

#### Acceptance Criteria

1. WHEN CloudFront returns an error, THEN the Frontend SHALL display a placeholder image
2. WHEN cookie authentication fails, THEN the Frontend SHALL attempt refresh once before showing error
3. WHEN Image_Resizer fails, THEN CloudFront SHALL serve the original image
4. THE System SHALL log all authentication and resize errors to CloudWatch
5. WHEN S3 is unavailable, THEN CloudFront SHALL return a cached version if available

### Requirement 17: Monitoring and Observability

**User Story:** As a DevOps engineer, I want comprehensive monitoring, so that I can detect and resolve issues quickly.

#### Acceptance Criteria

1. THE System SHALL log all cookie generation requests to CloudWatch
2. THE System SHALL log all Image_Resizer invocations with processing time
3. THE System SHALL track CloudFront cache hit ratio
4. THE System SHALL alert when 403 error rate exceeds 5% of requests
5. THE System SHALL track average image load time by size category (thumbnail, preview, full)
6. THE System SHALL monitor Lambda@Edge execution errors

### Requirement 18: Security Audit and Validation

**User Story:** As a security engineer, I want to validate the security implementation, so that I can confirm no vulnerabilities exist.

#### Acceptance Criteria

1. THE System SHALL verify that direct S3 access returns 403 for all test cases
2. THE System SHALL verify that expired cookies are rejected by CloudFront
3. THE System SHALL verify that users cannot access other organizations' images
4. THE System SHALL verify that cookie policies restrict access to correct organization paths
5. THE System SHALL verify that all image URLs use HTTPS only
6. THE System SHALL document the security model and threat mitigations

### Requirement 19: Offline-First Image Storage with TanStack Query

**User Story:** As a mobile user, I want images cached on my device, so that I can view them without internet access.

#### Acceptance Criteria

1. THE Frontend SHALL use TanStack Query with IndexedDB persistence (createSyncStoragePersister) for image caching
2. THE Frontend SHALL create a custom query function that fetches images as Blobs from CloudFront
3. THE Frontend SHALL store image Blobs in TanStack Query cache with metadata (s3Key, size, format, fetchedAt)
4. WHEN requesting an image, THEN TanStack Query SHALL check the persisted cache first before making network requests
5. THE Frontend SHALL configure image queries with staleTime of 7 days for thumbnails
6. THE Frontend SHALL configure image queries with gcTime (garbage collection) of 30 days
7. WHEN the device is offline, THEN TanStack Query SHALL serve images from persisted cache
8. THE Frontend SHALL use TanStack Query's networkMode: 'offlineFirst' for image queries
9. THE Frontend SHALL display a visual indicator when showing offline-cached images
10. THE Frontend SHALL limit persisted cache size by configuring maxAge and cache eviction policies
11. THE Frontend SHALL provide a settings option to clear cached images via queryClient.clear()
12. THE Frontend SHALL sync full-size images to cache only when explicitly requested by user (e.g., "Download for offline")

### Requirement 20: Progressive Image Loading

**User Story:** As a user, I want images to load progressively, so that I see content quickly even on slow connections.

#### Acceptance Criteria

1. THE Frontend SHALL display a low-quality placeholder while loading thumbnails
2. THE Frontend SHALL load thumbnails first, then upgrade to higher quality on user interaction
3. WHEN a user opens an image modal, THEN the Frontend SHALL show the cached thumbnail immediately
4. WHEN a user opens an image modal, THEN the Frontend SHALL load the full-size image in the background
5. THE Frontend SHALL display a loading indicator during background image fetch
6. WHEN the full-size image loads, THEN the Frontend SHALL smoothly transition from thumbnail to full-size
