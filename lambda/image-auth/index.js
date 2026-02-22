/**
 * CloudFront Cookie Generator Lambda (cwf-image-auth)
 * 
 * Generates CloudFront signed cookies after validating Cognito authentication.
 * Implements organization-scoped access control for secure image delivery.
 * 
 * Environment Variables:
 * - CLOUDFRONT_DOMAIN: CloudFront distribution domain (e.g., d1234567890.cloudfront.net)
 * - CLOUDFRONT_KEY_PAIR_ID: CloudFront public key ID for signed URLs
 * - CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME: SSM Parameter Store path containing private key
 * - COOKIE_EXPIRATION_SECONDS: Cookie expiration time (default: 3600 = 1 hour)
 * 
 * Validates: Requirements 2.1-2.7, 6.1-6.7
 */

const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const crypto = require('crypto');

// Initialize SSM client
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'us-west-2' });

// Environment configuration with validation
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const CLOUDFRONT_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID;
const CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME = process.env.CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME || '/cloudfront/private-key';
const COOKIE_EXPIRATION_SECONDS = parseInt(process.env.COOKIE_EXPIRATION_SECONDS || '3600', 10);

// Validate required environment variables
if (!CLOUDFRONT_DOMAIN) {
  throw new Error('CLOUDFRONT_DOMAIN environment variable is required');
}
if (!CLOUDFRONT_KEY_PAIR_ID) {
  throw new Error('CLOUDFRONT_KEY_PAIR_ID environment variable is required');
}

// Cache for private key (Lambda container reuse optimization)
let cachedPrivateKey = null;

/**
 * Fetch CloudFront private key from AWS Systems Manager Parameter Store
 * Implements caching to avoid repeated SSM calls
 * 
 * @returns {Promise<string>} PEM-formatted private key
 * @throws {Error} If parameter fetch fails
 */
async function getPrivateKey() {
  if (cachedPrivateKey) {
    console.log('Using cached private key');
    return cachedPrivateKey;
  }

  try {
    console.log(`Fetching private key from SSM Parameter Store: ${CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME}`);
    const command = new GetParameterCommand({
      Name: CLOUDFRONT_PRIVATE_KEY_PARAMETER_NAME,
      WithDecryption: true // Decrypt SecureString parameter
    });
    
    const response = await ssmClient.send(command);
    
    if (!response.Parameter || !response.Parameter.Value) {
      throw new Error('Parameter value is empty');
    }

    const privateKey = response.Parameter.Value;

    // Validate PEM format
    if (!privateKey.includes('BEGIN RSA PRIVATE KEY') && !privateKey.includes('BEGIN PRIVATE KEY')) {
      throw new Error('Invalid private key format (must be PEM)');
    }

    cachedPrivateKey = privateKey;
    console.log('Private key fetched and cached successfully');
    return privateKey;
  } catch (error) {
    console.error('Failed to fetch private key from SSM Parameter Store:', error);
    throw new Error(`SSM Parameter Store fetch failed: ${error.message}`);
  }
}

/**
 * Build CloudFront policy with organization-scoped resource path
 * 
 * @param {string} organizationId - Organization UUID from Cognito token
 * @param {number} expirationTime - Unix timestamp (seconds) when policy expires
 * @returns {object} CloudFront policy object
 */
function buildCloudFrontPolicy(organizationId, expirationTime) {
  // Resource path restricts access to organization's images only
  const resourcePath = `https://${CLOUDFRONT_DOMAIN}/organizations/${organizationId}/*`;
  
  const policy = {
    Statement: [
      {
        Resource: resourcePath,
        Condition: {
          DateLessThan: {
            'AWS:EpochTime': expirationTime
          }
        }
      }
    ]
  };

  console.log('Built CloudFront policy:', JSON.stringify(policy));
  return policy;
}

/**
 * Sign CloudFront policy using RSA-SHA1
 * 
 * @param {object} policy - CloudFront policy object
 * @param {string} privateKey - PEM-formatted RSA private key
 * @returns {string} Base64-encoded signature
 */
function signPolicy(policy, privateKey) {
  try {
    const policyString = JSON.stringify(policy);
    
    // Create signature using RSA-SHA1 (CloudFront requirement)
    const sign = crypto.createSign('RSA-SHA1');
    sign.update(policyString);
    const signature = sign.sign(privateKey, 'base64');
    
    // CloudFront requires URL-safe base64 encoding
    const urlSafeSignature = signature
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');
    
    console.log('Policy signed successfully');
    return urlSafeSignature;
  } catch (error) {
    console.error('Failed to sign policy:', error);
    throw new Error(`Policy signing failed: ${error.message}`);
  }
}

/**
 * Generate CloudFront signed cookies
 * 
 * @param {string} organizationId - Organization UUID from Cognito token
 * @returns {Promise<object>} Object containing cookie headers and expiration time
 */
async function generateSignedCookies(organizationId) {
  // Calculate expiration time
  const expirationTime = Math.floor(Date.now() / 1000) + COOKIE_EXPIRATION_SECONDS;
  const expiresAt = new Date(expirationTime * 1000).toISOString();

  // Build CloudFront policy
  const policy = buildCloudFrontPolicy(organizationId, expirationTime);
  const policyString = JSON.stringify(policy);
  
  // Base64-encode policy (URL-safe)
  const base64Policy = Buffer.from(policyString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/=/g, '_')
    .replace(/\//g, '~');

  // Fetch private key and sign policy
  const privateKey = await getPrivateKey();
  const signature = signPolicy(policy, privateKey);

  // Build Set-Cookie headers
  // CloudFront requires three cookies: Policy, Signature, Key-Pair-Id
  const cookieAttributes = `Domain=${CLOUDFRONT_DOMAIN}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_EXPIRATION_SECONDS}`;
  
  const cookies = [
    `CloudFront-Policy=${base64Policy}; ${cookieAttributes}`,
    `CloudFront-Signature=${signature}; ${cookieAttributes}`,
    `CloudFront-Key-Pair-Id=${CLOUDFRONT_KEY_PAIR_ID}; ${cookieAttributes}`
  ];

  console.log(`Generated signed cookies for organization ${organizationId}, expires at ${expiresAt}`);
  
  return {
    cookies,
    expiresAt
  };
}

/**
 * Extract organization_id from authorizer context
 * 
 * @param {object} event - API Gateway event
 * @returns {string|null} Organization UUID or null if not found
 */
function extractOrganizationId(event) {
  try {
    const authorizer = event.requestContext?.authorizer;
    
    if (!authorizer) {
      console.error('No authorizer found in request context');
      return null;
    }

    // Check multiple possible locations for organization_id
    // 1. Direct from custom authorizer context
    let orgId = authorizer.organization_id || authorizer.organizationId;
    
    // 2. From Cognito claims (if using Cognito authorizer)
    if (!orgId && authorizer.claims) {
      orgId = authorizer.claims['custom:organization_id'] || authorizer.claims.organization_id;
    }
    
    if (!orgId) {
      console.error('organization_id not found in authorizer context:', JSON.stringify(authorizer));
      return null;
    }

    console.log(`Extracted organization_id: ${orgId}`);
    return orgId;
  } catch (error) {
    console.error('Failed to extract organization_id:', error);
    return null;
  }
}

/**
 * Lambda handler for CloudFront cookie generation
 * 
 * @param {object} event - API Gateway event
 * @returns {Promise<object>} API Gateway response
 */
exports.handler = async (event) => {
  // Generate correlation ID for request tracking
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] Cookie generation request:`, {
    httpMethod: event.httpMethod,
    path: event.path,
    sourceIp: event.requestContext?.identity?.sourceIp
  });

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: ''
      };
    }

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      console.warn(`[${correlationId}] Invalid HTTP method: ${event.httpMethod}`);
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Method not allowed',
          message: 'Only POST requests are supported',
          correlationId
        })
      };
    }

    // Extract organization_id from Cognito token
    const organizationId = extractOrganizationId(event);
    
    if (!organizationId) {
      console.error(`[${correlationId}] Missing organization_id in token claims`);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'organization_id not found in authentication token',
          correlationId
        })
      };
    }

    // Generate signed cookies
    const { cookies, expiresAt } = await generateSignedCookies(organizationId);

    console.log(`[${correlationId}] Successfully generated cookies for organization ${organizationId}`);

    // Return success response with Set-Cookie headers
    // Note: Use multiValueHeaders for multiple Set-Cookie headers
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      multiValueHeaders: {
        'Set-Cookie': cookies
      },
      body: JSON.stringify({
        success: true,
        expiresAt,
        message: 'CloudFront cookies generated successfully',
        correlationId
      })
    };

  } catch (error) {
    console.error(`[${correlationId}] Error generating cookies:`, error);
    
    // Return 500 error with correlation ID for debugging
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to generate CloudFront cookies',
        correlationId
      })
    };
  }
};

// Export functions for testing
exports.buildCloudFrontPolicy = buildCloudFrontPolicy;
exports.signPolicy = signPolicy;
exports.extractOrganizationId = extractOrganizationId;
