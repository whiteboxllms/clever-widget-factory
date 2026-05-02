import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // setupFiles runs in each worker process before tests are collected,
    // allowing us to patch Module._resolveFilename for CJS require() calls.
    setupFiles: ['./__mocks__/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '*.config.js',
        'coverage/',
        '*.test.js'
      ]
    }
  }
});
