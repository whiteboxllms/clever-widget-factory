import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const USE_TRANSFER_ACCELERATION = false; // Temporarily disabled - CORS issue with accelerated endpoint
const BUCKET = 'cwf-dev-assets';
const USE_ORG_SCOPED_KEYS = process.env.USE_ORG_SCOPED_KEYS === 'true';

// Upload method: 'post' avoids CORS preflight issues on mobile browsers.
// 'put' is the legacy method kept for backward compatibility.
const UPLOAD_METHOD = process.env.UPLOAD_METHOD || 'post';

// Configure S3 client
// requestChecksumCalculation: "WHEN_REQUIRED" prevents the SDK from adding
// x-amz-checksum-crc32 to presigned URLs. Browser fetch() can't send that
// header, so S3 rejects the upload with SignatureDoesNotMatch.
const s3Client = new S3Client({ 
  region: 'us-west-2',
  useAccelerateEndpoint: USE_TRANSFER_ACCELERATION,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// ── Presigned PUT (legacy) ────────────────────────────────────────────
// Browser does: PUT <presignedUrl> with file body
// Requires CORS preflight (OPTIONS) which can fail on some mobile networks.
async function generatePresignedPut(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return { presignedUrl };
}

// ── Presigned POST ────────────────────────────────────────────────────
// Browser does: POST <url> with FormData (fields + file)
// Uses multipart/form-data which is a "simple" request — no CORS preflight.
// See: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-UsingHTTPPOST.html
async function generatePresignedPost(key, contentType) {
  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ['content-length-range', 0, maxFileSize],
      ['starts-with', '$Content-Type', contentType.split('/')[0] + '/'],
    ],
    Fields: {
      'Content-Type': contentType,
    },
    Expires: 3600, // 1 hour
  });

  return { postUrl: url, postFields: fields };
}

export const handler = async (event) => {
  console.log('Presigned URL request:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body);
    const { filename, contentType, method } = body;
    
    if (!filename || !contentType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'filename and contentType required' })
      };
    }

    // Allow client to request a specific method, otherwise use server default
    const uploadMethod = method || UPLOAD_METHOD;
    
    let key, finalKey;
    
    if (USE_ORG_SCOPED_KEYS) {
      const organizationId = event.requestContext?.authorizer?.organization_id;
      
      if (!organizationId) {
        console.error('Missing organization_id in authorizer context');
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'organization_id required for organization-scoped uploads' })
        };
      }
      
      key = `organizations/${organizationId}/images/uploads/${filename}`;
      finalKey = key.replace('/uploads/', '/');
      
      console.log('Organization-scoped upload:', { organizationId, filename, key, finalKey, uploadMethod });
    } else {
      const random = Math.random().toString(36).substring(2, 11);
      key = `mission-attachments/uploads/${random}-${filename}`;
      finalKey = key.replace('/uploads/', '/');
      
      console.log('Mission-attachments upload:', { random, key, finalKey, uploadMethod });
    }
    
    // Public URL is the final location after compression (without /uploads/)
    const publicUrl = `https://${BUCKET}.s3.us-west-2.amazonaws.com/${finalKey}`;
    
    let responseBody;

    if (uploadMethod === 'post') {
      const { postUrl, postFields } = await generatePresignedPost(key, contentType);
      responseBody = {
        uploadMethod: 'post',
        postUrl,
        postFields,
        publicUrl,
        key,
        // Include presignedUrl pointing to postUrl for backward compat logging
        presignedUrl: postUrl,
      };
      console.log('Generated presigned POST:', { uploadKey: key, finalKey, publicUrl, postUrl });
    } else {
      const { presignedUrl } = await generatePresignedPut(key, contentType);
      responseBody = {
        uploadMethod: 'put',
        presignedUrl,
        publicUrl,
        key,
      };
      console.log('Generated presigned PUT:', { uploadKey: key, finalKey, publicUrl });
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(responseBody)
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate presigned URL' })
    };
  }
};
