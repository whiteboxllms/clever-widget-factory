import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setupTests.ts'],
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

