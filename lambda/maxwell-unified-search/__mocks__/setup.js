/**
 * Vitest setupFiles — patches Node's Module._resolveFilename in the worker
 * process to redirect Lambda layer absolute paths to local mock files.
 *
 * This must run before index.js is imported so that require('/opt/nodejs/db')
 * resolves to the local mock rather than the non-existent Lambda layer path.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use createRequire to access the CJS Module object from ESM context
const require = createRequire(import.meta.url);
const Module = require('module');

const MOCK_DIR = __dirname;

const REDIRECTS = {
  '/opt/nodejs/db': join(MOCK_DIR, 'db.js'),
  '/opt/nodejs/sqlUtils': join(MOCK_DIR, 'sqlUtils.js'),
};

const originalResolve = Module._resolveFilename.bind(Module);

Module._resolveFilename = function (request, parent, isMain, options) {
  if (REDIRECTS[request]) {
    return REDIRECTS[request];
  }
  return originalResolve(request, parent, isMain, options);
};
