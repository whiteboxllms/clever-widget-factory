/**
 * Test helper functions and utilities
 */

import { v4 as uuidv4 } from 'uuid';
import { Product, Customer, ConversationSession } from '@/types/core';

// Mock data generators
export function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: uuidv4(),
    name: 'Test Tomato',
    description: 'Fresh red tomatoes from the farm',
    category: 'vegetables',
    unit: 'kg',
    basePrice: 5.99,
    stockQuantity: 100,
    harvestDate: new Date(),
    tags: ['fresh', 'organic'],
    sellable: true,
    ...overrides
  };
}

export function createMockCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    customerId: uuidv4(),
    name: 'Test Customer',
    preferredLanguage: 'en',
    visitCount: 1,
    totalSpent: 0,
    favoriteCategories: [],
    createdAt: new Date(),
    lastVisit: new Date(),
    ...overrides
  };
}

export function createMockSession(overrides: Partial<ConversationSession> = {}): ConversationSession {
  return {
    sessionId: uuidv4(),
    startTime: new Date(),
    lastActivity: new Date(),
    context: {
      currentIntent: undefined,
      entities: {},
      conversationHistory: [],
      preferences: {
        language: 'en',
        communicationStyle: 'casual',
        favoriteCategories: [],
      },
      negotiationHistory: [],
      upsellAttempts: []
    },
    cart: [],
    status: 'active',
    ...overrides
  };
}

// Test database helpers
export async function cleanupTestData() {
  // Implementation would clean up test data from database
  // For now, just a placeholder
}

// Property-based testing generators
export function generateRandomProduct() {
  const categories = ['vegetables', 'fruits', 'herbs', 'grains'];
  const units = ['kg', 'piece', 'bunch', 'liter'];
  
  return {
    id: uuidv4(),
    name: `Test Product ${Math.random().toString(36).substring(7)}`,
    description: 'Generated test product',
    category: categories[Math.floor(Math.random() * categories.length)],
    unit: units[Math.floor(Math.random() * units.length)],
    basePrice: Math.random() * 20 + 1, // $1-$21
    stockQuantity: Math.floor(Math.random() * 200),
    tags: ['test'],
    sellable: Math.random() > 0.5
  };
}

export function generateRandomCustomer() {
  return {
    customerId: uuidv4(),
    name: `Customer ${Math.random().toString(36).substring(7)}`,
    preferredLanguage: 'en',
    visitCount: Math.floor(Math.random() * 10) + 1,
    totalSpent: Math.random() * 1000,
    favoriteCategories: ['vegetables'],
    createdAt: new Date(),
    lastVisit: new Date()
  };
}

// Assertion helpers
export function expectValidProduct(product: any) {
  expect(product).toHaveProperty('id');
  expect(product).toHaveProperty('name');
  expect(product).toHaveProperty('sellable');
  expect(typeof product.basePrice).toBe('number');
  expect(product.basePrice).toBeGreaterThan(0);
  expect(typeof product.stockQuantity).toBe('number');
  expect(product.stockQuantity).toBeGreaterThanOrEqual(0);
}

export function expectValidSession(session: any) {
  expect(session).toHaveProperty('sessionId');
  expect(session).toHaveProperty('startTime');
  expect(session).toHaveProperty('context');
  expect(session.status).toMatch(/^(active|idle|completed|abandoned)$/);
}

// Time helpers
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createDateInPast(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

export function createDateInFuture(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}