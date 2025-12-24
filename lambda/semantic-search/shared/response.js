const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

function success(data, statusCode = 200) {
  return {
    statusCode,
    headers,
    body: JSON.stringify({ data })
  };
}

function error(message, statusCode = 500) {
  return {
    statusCode,
    headers,
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

module.exports = { success, error, corsResponse, headers };