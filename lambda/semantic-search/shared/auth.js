// Re-export from authorizerContext for backwards compatibility
const { 
  getAuthorizerContext, 
  buildOrganizationFilter, 
  hasPermission, 
  canAccessOrganization 
} = require('./authorizerContext');

module.exports = {
  getAuthorizerContext,
  buildOrganizationFilter,
  hasPermission,
  canAccessOrganization
};