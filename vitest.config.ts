import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lambda/**', // Lambda tests should be run with Node's test runner
    ],
    // Suppress known JSDOM URL errors - these are false positives
    // from jsdom's URL implementation and don't affect test results
    silent: false, // Keep verbose output but suppress specific errors
    onUnhandledError: (error, type) => {
      // Suppress JSDOM URL errors that are false positives
      const errorString = String(error);
      const errorStack = error instanceof Error ? (error.stack || '') : '';
      
      // Check if this is a JSDOM URL error
      const isJsdomUrlError = 
        errorString.includes('Cannot read properties of undefined') &&
        errorString.includes("reading 'get'") &&
        (errorStack.includes('webidl-conversions') || 
         errorStack.includes('whatwg-url') ||
         errorStack.includes('URL.js') ||
         errorStack.includes('jsdom') ||
         errorString.includes('webidl-conversions') || 
         errorString.includes('whatwg-url') ||
         errorString.includes('URL.js') ||
         errorString.includes('jsdom'));
      
      if (isJsdomUrlError) {
        // Suppress this error - it's a known JSDOM issue
        return;
      }
      
      // Let other errors propagate normally
      throw error;
    },
    // Enhanced reporting for local observability and CI/CD
    // Note: In CI, we override reporters to use 'github-actions' and 'junit'
    reporters: process.env.CI 
      ? ['github-actions', ['junit', { outputFile: './test-results.xml' }], 'verbose']
      : [
          'verbose', // Detailed terminal output
          ['html', { outputFile: './test-results.html' }], // HTML report for detailed analysis
          'json', // JSON output for programmatic parsing
        ],
    outputFile: {
      json: './test-results.json',
      html: './test-results.html',
      junit: './test-results.xml',
    },
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

