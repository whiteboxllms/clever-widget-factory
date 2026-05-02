/**
 * Vitest globalSetup — patches Node's Module._resolveFilename to redirect
 * Lambda layer absolute paths to local mock implementations.
 *
 * This runs in the main Node process before workers start, ensuring that
 * when index.js calls require('/opt/nodejs/db') it gets the local mock.
 */
const Module = require('module');
const path = require('path');

const MOCK_DIR = path.resolve(__dirname);

const REDIRECTS = {
  '/opt/nodejs/db': path.join(MOCK_DIR, 'db.js'),
  '/opt/nodejs/sqlUtils': path.join(MOCK_DIR, 'sqlUtils.js'),
};

const originalResolve = Module._resolveFilename.bind(Module);

function setup() {
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (REDIRECTS[request]) {
      return REDIRECTS[request];
    }
    return originalResolve(request, parent, isMain, options);
  };
}

function teardown() {
  Module._resolveFilename = originalResolve;
}

module.exports = { setup, teardown };
