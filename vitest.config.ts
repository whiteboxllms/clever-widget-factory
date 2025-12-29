import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

// Function to load environment variables from a file
function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  
  const envContent = readFileSync(filePath, 'utf8');
  const envVars: Record<string, string> = {};
  
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      envVars[key.trim()] = value;
    }
  }
  
  return envVars;
}

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setupTests.ts'],
    testTimeout: 10000,
    env: {
      // Load .env.test file for integration tests
      ...(process.env.INTEGRATION_TESTS === 'true' ? loadEnvFile('.env.test') : {}),
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lambda/**',
      '**/sari-sari-agent/**',
    ],
    silent: false,
    onUnhandledError: (error, type) => {
      const errorString = String(error);
      const errorStack = error instanceof Error ? (error.stack || '') : '';
      
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
        return;
      }
      
      throw error;
    },
    reporters: process.env.CI 
      ? ['github-actions', ['junit', { outputFile: './test-results.xml' }], 'verbose']
      : [
          'verbose',
          ['html', { outputFile: './test-results.html' }],
          'json',
        ],
    outputFile: {
      json: './test-results.json',
      html: './test-results.html',
      junit: './test-results.xml',
    },
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

