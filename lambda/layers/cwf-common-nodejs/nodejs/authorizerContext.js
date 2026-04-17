/**
 * Helper functions to extract and use authorizer context
 * Used by all Lambda functions to get organization context from API Gateway authorizer
 */

/**
 * Extract organization context from API Gateway event
 * Supports both direct authorizer context and nested context structure
 * 
 * If the request includes an X-Organization-Id header, and that org is in the
 * user's accessible_organization_ids, the context is scoped to that org:
 *   - organization_id is overridden to the requested org
 *   - user_role is set to the user's role in that specific org
 *   - permissions are recalculated for that role
 *   - accessible_organization_ids is narrowed to just that org
 * 
 * This allows frontend org switching without changing the authorizer or API Gateway.
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
    user_id: authorizer.cognito_user_id,
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
      user_id: authorizer.context.cognito_user_id,
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
  
  // --- X-Organization-Id header override ---
  // If the frontend sends this header, scope the context to that org.
  // The header is validated against accessible_organization_ids so users
  // cannot escalate access to orgs they don't belong to.
  const requestedOrgId = getHeader(event, 'X-Organization-Id');
  
  if (requestedOrgId && requestedOrgId !== context.organization_id) {
    const isAccessible = context.accessible_organization_ids?.includes(requestedOrgId);
    
    if (isAccessible) {
      // Find the user's role in the requested org
      const membership = context.organization_memberships?.find(
        m => m.organization_id === requestedOrgId
      );
      const orgRole = membership?.role || 'viewer';
      
      console.log('🔄 [ORG-SWITCH] Overriding organization context via X-Organization-Id header:', {
        original_org_id: context.organization_id,
        requested_org_id: requestedOrgId,
        original_role: context.user_role,
        new_role: orgRole
      });
      
      context.organization_id = requestedOrgId;
      context.user_role = orgRole;
      // Recalculate permissions for the selected org's role
      // Explicitly remove data:read:all so buildOrganizationFilter scopes to this org only
      context.permissions = calculatePermissionsForRole(orgRole, context.organization_memberships)
        .filter(p => p !== 'data:read:all' && p !== 'data:write:all');
      // Scope accessible orgs to just the selected org for data filtering
      context.accessible_organization_ids = [requestedOrgId];
    } else {
      console.warn('⚠️ [ORG-SWITCH] Requested org not in accessible list, ignoring:', {
        requested_org_id: requestedOrgId,
        accessible_organization_ids: context.accessible_organization_ids
      });
    }
  }
  
  return context;
}

/**
 * Extract a header value from the API Gateway event (case-insensitive)
 */
function getHeader(event, headerName) {
  const headers = event.headers || {};
  // API Gateway may lowercase header names
  const lowerName = headerName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) {
      return headers[key];
    }
  }
  return null;
}

/**
 * Calculate permissions for a given role
 * Mirrors the authorizer's calculatePermissions logic
 */
function calculatePermissionsForRole(role, organizationMemberships) {
  const permissions = [];
  
  switch (role) {
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
  
  return permissions;
}

/**
 * Parse JSON string safely
 * Also handles comma-separated strings for permissions
 */
function parseJSON(jsonString, defaultValue = null) {
  if (!jsonString) return defaultValue;
  
  // If it's already an array, return it
  if (Array.isArray(jsonString)) return jsonString;
  
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // If JSON parsing fails, try splitting by comma (for permissions string)
    if (typeof jsonString === 'string' && jsonString.includes(',')) {
      return jsonString.split(',').map(s => s.trim());
    }
    // If it's a single string value, wrap it in an array
    if (typeof jsonString === 'string' && jsonString.length > 0) {
      return [jsonString];
    }
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
  
  // Always scope to the active organization when one is set.
  // data:read:all is a superadmin permission for org setup — it should not
  // bypass org scoping for normal data queries.
  if (context.organization_id) {
    return {
      condition: `${prefix}organization_id = '${context.organization_id}'::uuid`,
      params: []
    };
  }
  
  // Fallback: filter by accessible organizations
  const accessibleOrgs = context.accessible_organization_ids || [];
  
  if (accessibleOrgs.length === 0) {
    // No accessible orgs - deny access
    return { condition: '1=0', params: [] };
  }
  
  if (accessibleOrgs.length === 1) {
    return {
      condition: `${prefix}organization_id = '${accessibleOrgs[0]}'::uuid`,
      params: []
    };
  }
  
  // Multiple orgs - use IN clause
  const orgIdsList = accessibleOrgs.map(id => `'${id.replace(/'/g, "''")}'::uuid`).join(',');
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
  calculatePermissionsForRole,
  getHeader,
  parseJSON
};

