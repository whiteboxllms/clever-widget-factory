function getAuthorizerContext(event) {
  return {
    user_id: event.requestContext?.authorizer?.cognito_user_id || event.requestContext?.authorizer?.claims?.sub,
    organization_id: event.requestContext?.authorizer?.organization_id || event.requestContext?.authorizer?.claims?.['custom:organization_id']
  };
}

module.exports = { getAuthorizerContext };
