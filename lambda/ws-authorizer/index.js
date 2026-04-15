/**
 * WebSocket Lambda Authorizer for API Gateway WebSocket API
 * 
 * Validates Cognito JWT tokens on $connect and extracts organization context.
 * 
 * Key difference from REST authorizer (lambda/authorizer/):
 * - Token comes from event.queryStringParameters.token (NOT event.authorizationToken)
 *   because the browser WebSocket API doesn't support custom headers.
 * - Resource ARN format differs for WebSocket APIs.
 * 
 * JWT verification and org lookup logic mirrors the REST authorizer pattern.
 * 
 * Returns IAM policy with context:
 *   { organization_id, cognito_user_id, permissions }
 */

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Database configuration (matches pattern from other Lambda functions)
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-west-2';
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// JWKS client for token verification
const jwks = jwksClient({
  jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000 // 24 hours
});

// In-memory cache for user organization data (5 minute TTL)
const userCache = new Map();

/**
 * Get cached user data
 */
function getCachedUser(cognitoUserId) {
  const cached = userCache.get(cognitoUserId);
  if (cached && cached.expires_at > Date.now()) {
    return cached.data;
  }
  userCache.delete(cognitoUserId);
  return null;
}

/**
 * Cache user data with TTL
 */
function setCachedUser(cognitoUserId, data, ttlMinutes = 5) {
  userCache.set(cognitoUserId, {
    data,
    expires_at: Date.now() + (ttlMinutes * 60 * 1000)
  });
}

/**
 * Get signing key for JWT verification
 */
function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

/**
 * Verify and decode Cognito JWT token
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.COGNITO_CLIENT_ID,
        issuer: COGNITO_ISSUER,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}

/**
 * Calculate user permissions based on role
 * (Same logic as REST authorizer)
 */
function calculatePermissions(userRole, organizationMemberships) {
  const permissions = [];

  switch (userRole) {
    case 'admin':
      permissions.push(
        'organizations:read',
        'organizations:update',
        'members:manage',
        'data:read',
        'data:read:all',
        'data:write',
        'data:write:all'
      );
      break;
    case 'leadership':
      permissions.push(
        'organizations:read',
        'data:read',
        'data:read:org',
        'data:write',
        'data:write:org'
      );
      break;
    case 'contributor':
      permissions.push(
        'data:read',
        'data:write'
      );
      break;
    case 'viewer':
      permissions.push('data:read');
      break;
    default:
      permissions.push('data:read');
  }

  // Grant cross-org read if admin in multiple orgs
  const adminOrgs = organizationMemberships.filter(m => m.role === 'admin');
  if (adminOrgs.length > 1) {
    permissions.push('organizations:read:multiple');
  }

  return permissions;
}

/**
 * Get user organization data from database
 * Resolves Cognito sub → user UUID and org context via organization_members table.
 * (Same logic as REST authorizer)
 */
async function getUserOrganizationData(cognitoUserId) {
  const dbClient = new Client(dbConfig);

  try {
    await dbClient.connect();

    // Get active organization memberships
    const membershipsQuery = `
      SELECT 
        organization_id,
        role
      FROM organization_members
      WHERE cognito_user_id = $1
        AND is_active = true
      ORDER BY created_at ASC;
    `;

    const membershipsResult = await dbClient.query(membershipsQuery, [cognitoUserId]);

    if (membershipsResult.rows.length === 0) {
      console.error('[WS-AUTHORIZER] No active organization memberships found for user:', cognitoUserId);
      return null;
    }

    // Primary organization is the first one (oldest membership)
    const primary = membershipsResult.rows[0];
    const primaryOrgId = primary.organization_id;

    const directMemberships = membershipsResult.rows.map(row => ({
      organization_id: row.organization_id,
      role: row.role
    }));

    const directOrgIds = directMemberships.map(m => m.organization_id);

    // Try to get partner organization memberships
    let partnerAccess = [];
    let accessibleOrgIds = [...directOrgIds];

    try {
      const partnerQuery = `
        SELECT 
          po.id as partner_organization_id,
          pm.role as partner_role,
          CASE 
            WHEN po.organization_a_id = $2 THEN po.organization_b_id
            ELSE po.organization_a_id
          END as accessible_organization_id
        FROM partner_members pm
        JOIN partner_organizations po ON pm.partner_organization_id = po.id
        WHERE pm.cognito_user_id = $1
          AND pm.is_active = true
          AND po.status = 'active'
          AND (
            po.organization_a_id = $2 OR 
            po.organization_b_id = $2
          );
      `;

      const partnerResult = await dbClient.query(partnerQuery, [cognitoUserId, primaryOrgId]);

      partnerAccess = partnerResult.rows.map(row => ({
        partner_organization_id: row.partner_organization_id,
        role: row.partner_role,
        organization_id: row.accessible_organization_id
      }));

      const partnerOrgIds = partnerAccess.map(p => p.organization_id);
      accessibleOrgIds = [...new Set([...directOrgIds, ...partnerOrgIds])];
    } catch (error) {
      // Partner tables may not exist yet — continue with direct memberships only
      console.log('[WS-AUTHORIZER] Partner tables not available, using direct memberships only');
    }

    const permissions = calculatePermissions(primary.role || 'member', directMemberships);

    // Grant data:read:all if admin in multiple organizations
    if (directMemberships.length > 1 && directMemberships.every(m => m.role === 'admin')) {
      permissions.push('data:read:all');
    }

    console.log('[WS-AUTHORIZER] User organization data:', {
      cognito_user_id: cognitoUserId,
      primary_org_id: primaryOrgId,
      primary_role: primary.role,
      accessible_org_ids_count: accessibleOrgIds.length,
      permissions
    });

    return {
      organization_id: primaryOrgId,
      organization_memberships: directMemberships,
      accessible_organization_ids: accessibleOrgIds,
      partner_access: partnerAccess,
      role: primary.role || 'member',
      permissions
    };
  } finally {
    await dbClient.end();
  }
}

/**
 * Generate IAM policy for API Gateway WebSocket
 */
function generatePolicy(principalId, effect, resource, context) {
  const policy = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource
        }
      ]
    }
  };

  if (context) {
    policy.context = context;
  }

  return policy;
}

/**
 * Main WebSocket authorizer handler
 * 
 * Key difference from REST authorizer:
 * Token is read from event.queryStringParameters.token because the browser
 * WebSocket API does not support custom headers during the handshake.
 */
exports.handler = async (event) => {
  console.log('[WS-AUTHORIZER] Event:', JSON.stringify(event, null, 2));

  try {
    // WebSocket: token comes from query string, not Authorization header
    const token = event.queryStringParameters?.token;

    if (!token) {
      console.error('[WS-AUTHORIZER] No token provided in query string');
      throw new Error('Unauthorized: No token provided');
    }

    // Remove 'Bearer ' prefix if present (shouldn't be, but handle gracefully)
    const cleanToken = token.replace(/^Bearer /, '');

    // Verify and decode JWT
    let decoded;
    try {
      decoded = await verifyToken(cleanToken);
    } catch (error) {
      console.error('[WS-AUTHORIZER] Token verification failed:', error.message);
      throw new Error('Unauthorized: Invalid token');
    }

    const cognitoUserId = decoded.sub;

    // Check cache first
    let userData = getCachedUser(cognitoUserId);

    if (!userData) {
      userData = await getUserOrganizationData(cognitoUserId);

      if (!userData) {
        console.error('[WS-AUTHORIZER] User not found in any organization:', cognitoUserId);
        throw new Error('Forbidden: User not found in any organization');
      }

      setCachedUser(cognitoUserId, userData, 5);
    }

    // Validate accessible_organization_ids
    if (!userData.accessible_organization_ids || userData.accessible_organization_ids.length === 0) {
      console.error('[WS-AUTHORIZER] No accessible organizations for user:', cognitoUserId);
      throw new Error('Forbidden: User has no accessible organizations');
    }

    // Build context for downstream Lambda functions
    const context = {
      organization_id: userData.organization_id,
      organization_memberships: JSON.stringify(userData.organization_memberships || []),
      accessible_organization_ids: JSON.stringify(userData.accessible_organization_ids),
      partner_access: JSON.stringify(userData.partner_access || []),
      cognito_user_id: cognitoUserId,
      user_role: userData.role,
      permissions: JSON.stringify(userData.permissions || [])
    };

    console.log('[WS-AUTHORIZER] Allowing connection for user:', {
      cognito_user_id: cognitoUserId,
      organization_id: userData.organization_id,
      permissions: userData.permissions
    });

    // Build resource ARN for WebSocket API
    // WebSocket methodArn format: arn:aws:execute-api:region:account:api-id/stage/$connect
    // Allow all routes on this API
    const resource = event.methodArn.split('/').slice(0, 2).join('/') + '/*';

    return generatePolicy(cognitoUserId, 'Allow', resource, context);

  } catch (error) {
    console.error('[WS-AUTHORIZER] Authorization failed:', error.message);

    // Return Deny policy for invalid/expired/malformed tokens
    const resource = event.methodArn
      ? event.methodArn.split('/').slice(0, 2).join('/') + '/*'
      : '*';

    return generatePolicy('user', 'Deny', resource);
  }
};
