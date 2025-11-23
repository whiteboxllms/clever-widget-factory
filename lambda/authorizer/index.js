/**
 * Lambda Authorizer for API Gateway
 * 
 * Validates Cognito JWT tokens and extracts organization context:
 * - organization_id: User's organization UUID
 * - is_superadmin: Whether user has superadmin privileges
 * - user_role: User's role in their organization
 * 
 * Uses caching to reduce database calls (5 minute TTL)
 */

const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Database configuration (matches pattern from other Lambda functions)
const dbConfig = {
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD || 'CWF_Dev_2025!',
  ssl: {
    rejectUnauthorized: false
  }
};

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_REGION = process.env.COGNITO_REGION || 'us-west-2';
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// JWKS client for token verification
const client = jwksClient({
  jwksUri: `${COGNITO_ISSUER}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000 // 24 hours
});

// In-memory cache for user organization data
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
  client.getSigningKey(header.kid, (err, key) => {
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
 * Get user organization data from database
 * Includes primary organization and partner organization access
 */
async function getUserOrganizationData(cognitoUserId) {
  const dbClient = new Client(dbConfig);
  
  try {
    await dbClient.connect();
    
    // Get primary organization membership
    const primaryQuery = `
      SELECT 
        organization_id,
        role,
        COALESCE(super_admin, false) as is_superadmin
      FROM organization_members
      WHERE cognito_user_id = $1
        AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1;
    `;
    
    const primaryResult = await dbClient.query(primaryQuery, [cognitoUserId]);
    
    if (primaryResult.rows.length === 0) {
      return null;
    }
    
    const primary = primaryResult.rows[0];
    const primaryOrgId = primary.organization_id;
    
    // Try to get partner organization memberships (gracefully handle if tables don't exist yet)
    let partnerAccess = [];
    let accessibleOrgIds = [primaryOrgId];
    
    try {
      const partnerQuery = `
        SELECT 
          po.id as partner_organization_id,
          po.organization_a_id,
          po.organization_b_id,
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
      
      const partnerResult = await dbClient.query(partnerQuery, [
        cognitoUserId,
        primaryOrgId
      ]);
      
      partnerAccess = partnerResult.rows.map(row => ({
        partner_organization_id: row.partner_organization_id,
        role: row.partner_role,
        organization_id: row.accessible_organization_id
      }));
      
      // Build accessible organization IDs list (primary + partner orgs)
      accessibleOrgIds = [
        primaryOrgId,
        ...partnerAccess.map(p => p.organization_id)
      ];
    } catch (error) {
      // Partner tables don't exist yet - that's okay, continue with primary org only
      console.log('Partner tables not available yet, using primary organization only');
    }
    
    return {
      organization_id: primaryOrgId,
      accessible_organization_ids: accessibleOrgIds,
      partner_access: partnerAccess,
      role: primary.role || 'member',
      is_superadmin: primary.is_superadmin || false
    };
  } finally {
    await dbClient.end();
  }
}

/**
 * Generate IAM policy for API Gateway
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
    },
    context: context || {}
  };
  
  return policy;
}

/**
 * Main authorizer handler
 */
exports.handler = async (event) => {
  console.log('Authorizer event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract token from Authorization header
    const token = event.authorizationToken;
    
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer /, '');
    
    // Verify and decode token
    let decoded;
    try {
      decoded = await verifyToken(cleanToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Unauthorized: Invalid token');
    }
    
    const cognitoUserId = decoded.sub;
    
    // Check cache first
    let userData = getCachedUser(cognitoUserId);
    
    if (!userData) {
      // Fetch from database
      userData = await getUserOrganizationData(cognitoUserId);
      
      if (!userData) {
        throw new Error('Forbidden: User not found in any organization');
      }
      
      // Cache the result
      setCachedUser(cognitoUserId, userData, 5);
    }
    
    // Generate policy with context
    // Include partner access information for multi-tenant data filtering
    const context = {
      organization_id: userData.organization_id,
      accessible_organization_ids: JSON.stringify(userData.accessible_organization_ids || [userData.organization_id]),
      partner_access: JSON.stringify(userData.partner_access || []),
      cognito_user_id: cognitoUserId,
      is_superadmin: userData.is_superadmin ? 'true' : 'false',
      user_role: userData.role
    };
    
    // Allow access to all API Gateway resources
    const resource = event.methodArn.split('/').slice(0, 2).join('/') + '/*/*';
    
    const policy = generatePolicy(cognitoUserId, 'Allow', resource, context);
    
    console.log('Generated policy:', JSON.stringify(policy, null, 2));
    
    return policy;
    
  } catch (error) {
    console.error('Authorizer error:', error);
    
    // Return deny policy
    const resource = event.methodArn.split('/').slice(0, 2).join('/') + '/*/*';
    return generatePolicy('user', 'Deny', resource);
  }
};

