/**
 * Test for useCognitoAuth module exports
 * 
 * This test ensures that the required exports (useAuth and AuthProvider) 
 * are properly exported from the module to prevent runtime errors like:
 * "The requested module does not provide an export named 'useAuth'"
 */

import { describe, it, expect } from 'vitest';

describe('useCognitoAuth module exports', () => {
  it('should export useAuth function', async () => {
    const module = await import('./useCognitoAuth');
    
    expect(module).toHaveProperty('useAuth');
    expect(typeof module.useAuth).toBe('function');
  });

  it('should export AuthProvider component', async () => {
    const module = await import('./useCognitoAuth');
    
    expect(module).toHaveProperty('AuthProvider');
    expect(typeof module.AuthProvider).toBe('function');
  });

  it('should export both useAuth and AuthProvider', async () => {
    const module = await import('./useCognitoAuth');
    
    const exports = Object.keys(module);
    expect(exports).toContain('useAuth');
    expect(exports).toContain('AuthProvider');
  });

  it('should export useAuth as a named export (not default)', async () => {
    const module = await import('./useCognitoAuth');
    
    // Verify it's a named export, not default
    expect(module.useAuth).toBeDefined();
    expect(module.default).not.toBe(module.useAuth);
  });

  it('should export AuthProvider as a named export (not default)', async () => {
    const module = await import('./useCognitoAuth');
    
    // Verify it's a named export, not default
    expect(module.AuthProvider).toBeDefined();
    expect(module.default).not.toBe(module.AuthProvider);
  });

  it('should have useAuth that is a callable function', async () => {
    const module = await import('./useCognitoAuth');
    
    // Verify useAuth is a function that can be called
    expect(module.useAuth).toBeDefined();
    expect(typeof module.useAuth).toBe('function');
    
    // Verify it throws the expected error when used outside provider
    // This confirms the hook is properly structured
    expect(() => {
      try {
        module.useAuth();
      } catch (error: any) {
        if (error.message) {
          expect(error.message).toContain('useAuth must be used within an AuthProvider');
        }
        throw error; // Re-throw to verify it does throw
      }
    }).toThrow();
  });
});

