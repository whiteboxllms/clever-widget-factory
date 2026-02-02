const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

function successResponse(data, customHeaders = {}) {
  return {
    statusCode: 200,
    headers: { ...headers, ...customHeaders },
    body: JSON.stringify(data)
  };
}

function errorResponse(statusCode, message, customHeaders = {}) {
  return {
    statusCode,
    headers: { ...headers, ...customHeaders },
    body: JSON.stringify({ error: message })
  };
}

function corsResponse() {
  return {
    statusCode: 200,
    headers,
    body: ''
  };
}

module.exports = { successResponse, errorResponse, corsResponse, headers };
