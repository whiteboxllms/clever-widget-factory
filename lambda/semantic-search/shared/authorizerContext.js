/**
 * Helper functions to extract and use authorizer context
 * Used by all Lambda functions to get organization context from API Gateway authorizer
 */

/**
 * Extract organization context from API Gateway event
 * Supports both direct authorizer context and nested context structure
 */
function getAuthorizerContext(event) {
  const authorizer = event.requestContext?.authorizer || {};
  
  // Try direct context first (API Gateway format)
  let context = {
    organization_id: authorizer.organization_id,
    organization_memberships: parseJSON(authorizer.organization_memberships, []),
    accessible_organization_ids: parseJSON(authorizer.accessible_organization_ids, []),
    partner_access: parseJSON(authorizer.partner_access, []),
    cognito_user_id: authorizer.cognito_user_id,
    user_role: authorizer.user_role,
    permissions: parseJSON(authorizer.permissions, [])
  };
  
  // Log parsing for debugging
  if (authorizer.accessible_organization_ids) {
    console.log('Parsing accessible_organization_ids from authorizer:', {
      raw: authorizer.accessible_organization_ids,
      parsed: context.accessible_organization_ids,
      parsed_length: context.accessible_organization_ids.length
    });
  }
  
  // Fallback to nested context if direct not available
  if (!context.organization_id && authorizer.context) {
    context = {
      organization_id: authorizer.context.organization_id,
      organization_memberships: parseJSON(authorizer.context.organization_memberships, []),
      accessible_organization_ids: parseJSON(authorizer.context.accessible_organization_ids, []),
      partner_access: parseJSON(authorizer.context.partner_access, []),
      cognito_user_id: authorizer.context.cognito_user_id,
      user_role: authorizer.context.user_role,
      permissions: parseJSON(authorizer.context.permissions, [])
    };
    
    // Log nested context parsing
    if (authorizer.context.accessible_organization_ids) {
      console.log('Parsing accessible_organization_ids from nested context:', {
        raw: authorizer.context.accessible_organization_ids,
        parsed: context.accessible_organization_ids,
        parsed_length: context.accessible_organization_ids.length
      });
    }
  }
  
  return context;
}

/**
 * Parse JSON string safely
 */
function parseJSON(jsonString, defaultValue = null) {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('Failed to parse JSON:', jsonString, e);
    return defaultValue;
  }
}

/**
 * Check if user has a specific permission
 */
function hasPermission(context, permission) {
  if (!context || !context.permissions) return false;
  
  // system:admin grants all permissions
  if (context.permissions.includes('system:admin')) {
    return true;
  }
  
  return context.permissions.includes(permission);
}

/**
 * Check if user can access a specific organization
 */
function canAccessOrganization(context, organizationId) {
  if (!context || !organizationId) return false;
  
  // Users with data:read:all permission can access all organizations
  if (hasPermission(context, 'data:read:all')) {
    return true;
  }
  
  // Check if organization is in accessible list
  return context.accessible_organization_ids?.includes(organizationId) || false;
}

/**
 * Build WHERE clause for organization filtering
 * Returns SQL condition and parameters
 */
function buildOrganizationFilter(context, tableAlias = '') {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // Users with data:read:all permission can access all organizations
  // This replaces the old superadmin concept - access is now based on permissions
  if (hasPermission(context, 'data:read:all')) {
    return { condition: '', params: [] };
  }
  
  // Filter by accessible organizations
  const accessibleOrgs = context.accessible_organization_ids || [];
  
  if (accessibleOrgs.length === 0) {
    // No accessible orgs - deny access
    return { condition: '1=0', params: [] };
  }
  
  if (accessibleOrgs.length === 1) {
    return {
      condition: `${prefix}organization_id = '${accessibleOrgs[0]}'`,
      params: []
    };
  }
  
  // Multiple orgs - use IN clause
  const orgIdsList = accessibleOrgs.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
  return {
    condition: `${prefix}organization_id IN (${orgIdsList})`,
    params: []
  };
}

/**
 * Get user's role in a specific organization
 */
function getRoleInOrganization(context, organizationId) {
  if (!context || !organizationId) return null;
  
  const membership = context.organization_memberships?.find(
    m => m.organization_id === organizationId
  );
  
  return membership?.role || null;
}

module.exports = {
  getAuthorizerContext,
  hasPermission,
  canAccessOrganization,
  buildOrganizationFilter,
  getRoleInOrganization,
  parseJSON
};