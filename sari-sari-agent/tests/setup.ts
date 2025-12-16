/**
 * Test setup and configuration
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'farm_db_test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Global test setup
beforeAll(async () => {
  // Setup test database if needed
  // Initialize test data
  console.log('🧪 Test environment initialized');
});

afterAll(async () => {
  // Cleanup test resources
  console.log('🧹 Test environment cleaned up');
});

beforeEach(() => {
  // Reset any global state before each test
});