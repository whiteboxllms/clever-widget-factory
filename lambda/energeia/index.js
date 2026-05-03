const { getAuthorizerContext } = require('/opt/nodejs/authorizerContext');
const { successResponse, errorResponse } = require('/opt/nodejs/response');
const pool = require('./lib/db');
const { getSchema } = require('./handlers/getSchema');
const { refresh } = require('./handlers/refresh');

const success = (data) => successResponse(data);
const error = (message, statusCode = 500) => errorResponse(statusCode, message);

exports.handler = async (event) => {
  const { httpMethod, path } = event;

  // --- Auth context ---
  let organizationId;
  try {
    const authContext = getAuthorizerContext(event);
    organizationId = authContext?.organization_id;
  } catch (err) {
    console.error('[energeia] Error getting authorizer context:', err);
    organizationId = null;
  }

  if (!organizationId) {
    return error('Organization ID not found', 401);
  }

  try {
    // GET /api/energeia/schema — read cache
    if (httpMethod === 'GET' && path === '/api/energeia/schema') {
      const result = await getSchema(pool, organizationId);
      return success(result);
    }

    // POST /api/energeia/refresh — run full pipeline
    if (httpMethod === 'POST' && path === '/api/energeia/refresh') {
      let body;
      try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
      } catch (parseErr) {
        console.error('[energeia] Error parsing request body:', parseErr);
        return error('Invalid JSON in request body', 400);
      }

      const result = await refresh(pool, organizationId, body);

      if (result.statusCode === 400) {
        return error(result.error, 400);
      }
      if (result.statusCode === 500) {
        return error(result.error, 500);
      }

      return success({ data: result.data });
    }

    return error('Not found', 404);
  } catch (err) {
    console.error('[energeia] Unhandled error:', err);
    return error(err.message, 500);
  }
};
