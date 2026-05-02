// Mock for /opt/nodejs/db Lambda layer dependency
module.exports = {
  getDbClient: () => { throw new Error('DB not available in unit tests'); },
};
