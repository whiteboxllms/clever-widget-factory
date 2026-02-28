import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const USE_TRANSFER_ACCELERATION = false; // Temporarily disabled - CORS issue with accelerated endpoint
const BUCKET = 'cwf-dev-assets';
const USE_ORG_SCOPED_KEYS = process.env.USE_ORG_SCOPED_KEYS === 'true';

// Configure S3 client with Transfer Acceleration
const s3Client = new S3Client({ 
  region: 'us-west-2',
  useAccelerateEndpoint: USE_TRANSFER_ACCELERATION
});

export const handler = async (event) => {
  console.log('Presigned URL request:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body);
    const { filename, contentType } = body;
    
    if (!filename || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'filename and contentType required' })
      };
    }
    
    let key, finalKey;
    
    if (USE_ORG_SCOPED_KEYS) {
      // Extract organization_id from authorizer context (set by cwf-api-authorizer)
      const organizationId = event.requestContext?.authorizer?.organization_id;
      
      if (!organizationId) {
        console.error('Missing organization_id in authorizer context');
        console.error('Request context:', JSON.stringify(event.requestContext, null, 2));
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'organization_id required for organization-scoped uploads' })
        };
      }
      
      // Use original filename (phone camera filenames are already unique: PXL_20260223_230751854.jpg)
      // Organization-scoped path: organizations/{org_id}/images/uploads/{filename}
      key = `organizations/${organizationId}/images/uploads/${filename}`;
      // Final path after compression: organizations/{org_id}/images/{filename}
      finalKey = key.replace('/uploads/', '/');
      
      console.log('Organization-scoped upload:', { organizationId, filename, key, finalKey });
    } else {
      // Legacy mission-attachments path (backward compatible)
      // Generate unique key with random string at front
      // Format: abc123-filename.jpg
      const random = Math.random().toString(36).substring(2, 11);
      key = `mission-attachments/uploads/${random}-${filename}`;
      // Final path after compression: mission-attachments/abc123-filename.jpg
      finalKey = key.replace('/uploads/', '/');
      
      console.log('Mission-attachments upload:', { random, key, finalKey });
    }
    
    // Generate presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });
    
    // Public URL is the final location after compression (without /uploads/)
    const publicUrl = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${finalKey}`;
    
    console.log('Generated presigned URL:', { uploadKey: key, finalKey, publicUrl });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        presignedUrl,
        publicUrl,
        key,
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate presigned URL' })
    };
  }
};
