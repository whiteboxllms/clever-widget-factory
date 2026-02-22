# Requirements Document: Image Metadata Extraction

## Introduction

This feature implements automatic EXIF metadata extraction from uploaded images and stores the metadata in a PostgreSQL database for querying and analytics. When users upload photos to the CWF system, the system will automatically extract GPS coordinates, capture timestamps, camera information, and image dimensions, enabling powerful location-based queries, timeline analysis, and quality tracking for farm operations.

The system processes images asynchronously via S3 event triggers, ensuring no impact on upload speed. Metadata is stored in structured database columns (not JSONB blobs) to enable efficient indexing and querying.

## Glossary

- **EXIF**: Exchangeable Image File Format - metadata standard embedded in image files by cameras and smartphones
- **GPS Coordinates**: Geographic location data (latitude, longitude, altitude) embedded in image EXIF data
- **Capture Timestamp**: The actual date/time when a photo was taken (from EXIF), distinct from upload timestamp
- **S3 Event Trigger**: AWS Lambda invocation triggered automatically when an object is created in S3
- **Sharp Library**: High-performance Node.js image processing library with EXIF parsing capabilities
- **DMS Format**: Degrees, Minutes, Seconds - EXIF GPS coordinate format that must be converted to decimal degrees
- **Origin Access Identity (OAI)**: AWS mechanism allowing Lambda to access private S3 buckets
- **Image_Metadata_Extractor**: Lambda function that extracts EXIF data and writes to database
- **Database**: PostgreSQL RDS instance storing CWF application data
- **Organization**: Multi-tenant entity that owns images and metadata
- **S3_Key**: Unique identifier for an image in S3, format: `organizations/{org_id}/images/{uuid}.{extension}`

## Requirements

### Requirement 1: EXIF Metadata Extraction

**User Story:** As a farm manager, I want the system to automatically extract metadata from uploaded photos, so that I can track where and when photos were taken without manual data entry.

#### Acceptance Criteria

1. WHEN an image is uploaded to S3 prefix `organizations/*/images/*`, THE Image_Metadata_Extractor SHALL be triggered automatically
2. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract GPS latitude, longitude, and altitude from EXIF data
3. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract capture timestamp from EXIF DateTimeOriginal field
4. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract camera make and model from EXIF data
5. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract original image dimensions (width and height)
6. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract EXIF orientation flag
7. WHEN an image contains GPS coordinates in DMS format, THE Image_Metadata_Extractor SHALL convert them to decimal degrees with 8 decimal places precision
8. WHEN an image contains EXIF DateTimeOriginal in format "YYYY:MM:DD HH:MM:SS", THE Image_Metadata_Extractor SHALL convert it to ISO 8601 timestamp
9. WHEN an image lacks EXIF data, THE Image_Metadata_Extractor SHALL store NULL values for missing fields and continue processing
10. WHEN an image is corrupted or unreadable, THE Image_Metadata_Extractor SHALL log an error and skip metadata extraction without failing

### Requirement 2: Database Storage

**User Story:** As a developer, I want metadata stored in structured database columns, so that I can write efficient queries for location-based and time-based searches.

#### Acceptance Criteria

1. THE Database SHALL have an image_metadata table with columns for s3_key, organization_id, file_size_bytes, mime_type, gps_latitude, gps_longitude, gps_altitude, captured_at, camera_make, camera_model, original_width, original_height, orientation, original_filename, uploaded_by, uploaded_at, and exif_extracted_at
2. WHEN Image_Metadata_Extractor successfully extracts metadata, THE Image_Metadata_Extractor SHALL insert a record into image_metadata table
3. WHEN Image_Metadata_Extractor processes an image that already has metadata, THE Image_Metadata_Extractor SHALL update the existing record (upsert on s3_key)
4. THE Database SHALL enforce a unique constraint on s3_key in image_metadata table
5. THE Database SHALL enforce a foreign key constraint from image_metadata.organization_id to organizations.id with CASCADE DELETE
6. THE Database SHALL have an index on (organization_id, gps_latitude, gps_longitude) for location-based queries
7. THE Database SHALL have an index on (organization_id, captured_at) for time-based queries
8. THE Database SHALL have an index on s3_key for fast lookups by image identifier
9. WHEN GPS coordinates are stored, THE Database SHALL use DECIMAL(10, 8) for latitude and DECIMAL(11, 8) for longitude
10. WHEN metadata extraction completes, THE Image_Metadata_Extractor SHALL set exif_extracted_at to current timestamp

### Requirement 3: Asynchronous Processing

**User Story:** As a user, I want image uploads to complete quickly, so that I don't have to wait for metadata extraction before continuing my work.

#### Acceptance Criteria

1. WHEN a user uploads an image via presigned URL, THE upload SHALL complete without waiting for metadata extraction
2. WHEN an image is uploaded to S3, THE S3 event trigger SHALL invoke Image_Metadata_Extractor asynchronously
3. WHEN Image_Metadata_Extractor is invoked, THE Image_Metadata_Extractor SHALL complete processing within 5 seconds per image
4. WHEN Image_Metadata_Extractor fails with a transient error, THE Lambda runtime SHALL retry the invocation automatically
5. WHEN Image_Metadata_Extractor fails after retries, THE Lambda runtime SHALL send the event to a dead-letter queue for investigation
6. THE Image_Metadata_Extractor SHALL have a timeout of 30 seconds
7. THE Image_Metadata_Extractor SHALL have 512 MB memory allocation for Sharp library processing
8. WHEN multiple images are uploaded simultaneously, THE S3 event trigger SHALL invoke Image_Metadata_Extractor once per image

### Requirement 4: Image Format Support

**User Story:** As a user, I want metadata extraction to work with all common image formats, so that I can upload photos from any device without compatibility issues.

#### Acceptance Criteria

1. WHEN an image is in JPEG format, THE Image_Metadata_Extractor SHALL extract EXIF metadata
2. WHEN an image is in PNG format, THE Image_Metadata_Extractor SHALL extract EXIF metadata if present
3. WHEN an image is in HEIC format, THE Image_Metadata_Extractor SHALL extract EXIF metadata
4. WHEN an image is in HEIF format, THE Image_Metadata_Extractor SHALL extract EXIF metadata
5. WHEN an image is in WebP format, THE Image_Metadata_Extractor SHALL extract EXIF metadata if present
6. WHEN an image format does not support EXIF, THE Image_Metadata_Extractor SHALL store NULL values for EXIF fields
7. WHEN an image has an unsupported format, THE Image_Metadata_Extractor SHALL log a warning and skip processing

### Requirement 5: Original Filename Preservation

**User Story:** As a user, I want to see the original filename I used when uploading, so that I can identify photos by their meaningful names even though S3 uses UUIDs.

#### Acceptance Criteria

1. WHEN a user uploads an image via presigned URL, THE Presigned_Upload_Lambda SHALL extract the original filename from the request
2. WHEN Presigned_Upload_Lambda generates a presigned URL, THE Presigned_Upload_Lambda SHALL return the original filename in the response
3. WHEN the frontend receives the upload response, THE frontend SHALL store the original filename in the database alongside the S3 key
4. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL retrieve the original filename from the database or S3 metadata
5. THE image_metadata table SHALL have an original_filename column of type TEXT
6. WHEN displaying images in the UI, THE frontend SHALL show the original filename to users

### Requirement 6: Location-Based Queries

**User Story:** As a farm manager, I want to find all photos taken at a specific field location, so that I can review work done in that area.

#### Acceptance Criteria

1. WHEN a user queries for images by GPS coordinates, THE Database SHALL return all images within a specified radius
2. WHEN GPS coordinates are queried, THE Database SHALL use the spatial index on (gps_latitude, gps_longitude) for performance
3. WHEN an image has NULL GPS coordinates, THE image SHALL be excluded from location-based query results
4. WHEN a user queries for images without GPS data, THE Database SHALL return all images where gps_latitude IS NULL
5. THE Database SHALL support queries for images within a bounding box (min/max latitude and longitude)

### Requirement 7: Time-Based Queries

**User Story:** As a farm manager, I want to find all photos taken on a specific date, so that I can review daily activities.

#### Acceptance Criteria

1. WHEN a user queries for images by capture date, THE Database SHALL return images based on captured_at timestamp (not uploaded_at)
2. WHEN a user queries for images in a date range, THE Database SHALL use the index on captured_at for performance
3. WHEN an image has NULL captured_at, THE image SHALL be excluded from time-based query results
4. WHEN a user queries for images without capture timestamps, THE Database SHALL return all images where captured_at IS NULL
5. THE Database SHALL support queries for images captured within a specific time range (start and end timestamps)

### Requirement 8: Error Handling and Reliability

**User Story:** As a system administrator, I want metadata extraction to be reliable and handle errors gracefully, so that one bad image doesn't break the entire system.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor encounters a corrupted image, THE Image_Metadata_Extractor SHALL log the error and continue without failing
2. WHEN Image_Metadata_Extractor fails to fetch an image from S3, THE Image_Metadata_Extractor SHALL retry with exponential backoff
3. WHEN Image_Metadata_Extractor fails to write to the database, THE Image_Metadata_Extractor SHALL retry once before failing
4. WHEN Image_Metadata_Extractor fails after all retries, THE Lambda runtime SHALL send the event to a dead-letter queue
5. WHEN Image_Metadata_Extractor processes an image successfully, THE Image_Metadata_Extractor SHALL log the s3_key and extracted metadata summary
6. WHEN Image_Metadata_Extractor encounters an unexpected error, THE Image_Metadata_Extractor SHALL log the full error stack trace to CloudWatch
7. IF Image_Metadata_Extractor times out after 30 seconds, THEN THE Lambda runtime SHALL terminate the invocation and retry

### Requirement 9: Idempotency

**User Story:** As a system administrator, I want metadata extraction to be idempotent, so that re-processing the same image doesn't create duplicate records or inconsistent data.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image that already has metadata, THE Image_Metadata_Extractor SHALL update the existing record
2. WHEN Image_Metadata_Extractor updates an existing record, THE Image_Metadata_Extractor SHALL preserve the original uploaded_at timestamp
3. WHEN Image_Metadata_Extractor updates an existing record, THE Image_Metadata_Extractor SHALL update exif_extracted_at to the current timestamp
4. WHEN the same S3 event is delivered multiple times, THE Image_Metadata_Extractor SHALL produce the same database state
5. THE Database SHALL use ON CONFLICT (s3_key) DO UPDATE for upsert operations

### Requirement 10: Organization Multi-Tenancy

**User Story:** As a system architect, I want metadata to be scoped by organization, so that each organization can only access their own image metadata.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract organization_id from the S3 key path
2. WHEN Image_Metadata_Extractor stores metadata, THE Image_Metadata_Extractor SHALL include organization_id in the database record
3. WHEN a user queries for image metadata, THE Database SHALL filter results by the user's organization_id
4. WHEN an organization is deleted, THE Database SHALL cascade delete all associated image_metadata records
5. THE S3 key pattern SHALL be `organizations/{org_id}/images/{uuid}.{extension}` to enable organization extraction

### Requirement 11: Performance and Scalability

**User Story:** As a system administrator, I want metadata extraction to scale efficiently, so that the system can handle high upload volumes during peak farm activity.

#### Acceptance Criteria

1. WHEN 100 images are uploaded simultaneously, THE Image_Metadata_Extractor SHALL process all images within 10 minutes
2. WHEN Image_Metadata_Extractor processes an image, THE processing time SHALL be less than 5 seconds per image
3. WHEN Image_Metadata_Extractor fetches an image from S3, THE fetch time SHALL be less than 2 seconds
4. WHEN Image_Metadata_Extractor writes to the database, THE write time SHALL be less than 500 milliseconds
5. THE Image_Metadata_Extractor SHALL use connection pooling for database connections
6. THE Image_Metadata_Extractor SHALL reuse database connections across invocations when possible

### Requirement 12: Monitoring and Observability

**User Story:** As a system administrator, I want to monitor metadata extraction success rates, so that I can identify and fix issues quickly.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL log the s3_key, processing time, and extracted metadata summary
2. WHEN Image_Metadata_Extractor fails, THE Image_Metadata_Extractor SHALL log the error type, s3_key, and error message
3. WHEN Image_Metadata_Extractor completes successfully, THE Image_Metadata_Extractor SHALL emit a CloudWatch metric for success count
4. WHEN Image_Metadata_Extractor fails, THE Image_Metadata_Extractor SHALL emit a CloudWatch metric for failure count
5. THE CloudWatch dashboard SHALL display success rate, average processing time, and error count for Image_Metadata_Extractor
6. WHEN the error rate exceeds 5%, THE CloudWatch alarm SHALL send an alert to administrators

### Requirement 13: GPS Coordinate Precision

**User Story:** As a farm manager, I want GPS coordinates to be accurate to within 0.1 meters, so that I can precisely locate where photos were taken in the field.

#### Acceptance Criteria

1. WHEN GPS coordinates are stored, THE Database SHALL store latitude with 8 decimal places precision
2. WHEN GPS coordinates are stored, THE Database SHALL store longitude with 8 decimal places precision
3. WHEN GPS coordinates are converted from DMS to decimal, THE Image_Metadata_Extractor SHALL preserve precision to 8 decimal places
4. WHEN GPS coordinates are queried, THE Database SHALL return values with full precision (no rounding)
5. THE GPS coordinate precision SHALL support accuracy to approximately 0.1 meters

### Requirement 14: Camera Information Tracking

**User Story:** As a farm manager, I want to track which camera or device was used for each photo, so that I can identify low-quality images and provide feedback to users.

#### Acceptance Criteria

1. WHEN an image contains EXIF camera make, THE Image_Metadata_Extractor SHALL store it in the camera_make column
2. WHEN an image contains EXIF camera model, THE Image_Metadata_Extractor SHALL store it in the camera_model column
3. WHEN a user queries for images by camera make, THE Database SHALL return all images from that manufacturer
4. WHEN a user queries for images by camera model, THE Database SHALL return all images from that specific device
5. WHEN an image lacks camera information, THE Image_Metadata_Extractor SHALL store NULL in camera_make and camera_model columns

### Requirement 15: Image Dimensions Tracking

**User Story:** As a system administrator, I want to track original image dimensions, so that I can identify oversized images and optimize storage costs.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract original width and height
2. WHEN image dimensions are stored, THE Database SHALL use INTEGER type for width and height columns
3. WHEN a user queries for oversized images, THE Database SHALL return images where width > 4000 OR height > 4000
4. WHEN a user queries for small images, THE Database SHALL return images where width < 800 AND height < 800
5. THE image_metadata table SHALL have columns original_width and original_height

### Requirement 16: EXIF Orientation Handling

**User Story:** As a user, I want images to display with correct orientation, so that photos taken in portrait mode don't appear sideways.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract EXIF orientation flag (1-8)
2. WHEN orientation is stored, THE Database SHALL use SMALLINT type for the orientation column
3. WHEN an image lacks orientation data, THE Image_Metadata_Extractor SHALL store NULL in the orientation column
4. WHEN the frontend displays an image, THE frontend SHALL apply CSS transforms based on the orientation value
5. THE orientation values SHALL follow EXIF standard: 1=normal, 3=180°, 6=90°CW, 8=90°CCW

### Requirement 17: Uploaded By Tracking

**User Story:** As a farm manager, I want to know who uploaded each photo, so that I can track accountability and provide feedback.

#### Acceptance Criteria

1. WHEN a user uploads an image, THE Presigned_Upload_Lambda SHALL extract the user's Cognito ID from the authorization token
2. WHEN Presigned_Upload_Lambda generates a presigned URL, THE Presigned_Upload_Lambda SHALL include the user ID in S3 object metadata
3. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL extract uploaded_by from S3 object metadata
4. THE image_metadata table SHALL have an uploaded_by column of type UUID referencing users table
5. WHEN a user queries for images they uploaded, THE Database SHALL return all images where uploaded_by matches their user ID

### Requirement 18: Upload Timestamp Tracking

**User Story:** As a farm manager, I want to distinguish between when a photo was taken and when it was uploaded, so that I can identify photos uploaded days after capture.

#### Acceptance Criteria

1. WHEN Image_Metadata_Extractor processes an image, THE Image_Metadata_Extractor SHALL store the S3 object creation time as uploaded_at
2. THE image_metadata table SHALL have both captured_at and uploaded_at columns
3. WHEN a user queries for recently uploaded images, THE Database SHALL use uploaded_at for filtering
4. WHEN a user queries for recently captured images, THE Database SHALL use captured_at for filtering
5. WHEN captured_at is NULL, THE Database SHALL fall back to uploaded_at for time-based queries
