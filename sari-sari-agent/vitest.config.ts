import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/agent': path.resolve(__dirname, './src/agent'),
      '@/inventory': path.resolve(__dirname, './src/inventory'),
      '@/pricing': path.resolve(__dirname, './src/pricing'),
      '@/nlp': path.resolve(__dirname, './src/nlp'),
      '@/database': path.resolve(__dirname, './src/database')
    }
  }
});