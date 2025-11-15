// Quality tests for the new client
import { describe, it, expect, vi } from 'vitest';
import { client } from './client';

describe('Database Client', () => {
  it('should create query builder with proper chaining', () => {
    const query = client.from('tools');
    expect(query).toBeDefined();
    expect(typeof query.select).toBe('function');
    expect(typeof query.eq).toBe('function');
    expect(typeof query.or).toBe('function');
  });

  it('should handle OR conditions properly', () => {
    const query = client.from('tools')
      .select('*')
      .or('name.ilike.%test%,category.ilike.%test%');
    
    expect(query).toBeDefined();
    // Should not throw "or is not a function" error
  });

  it('should support method chaining', () => {
    const query = client.from('tools')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .range(0, 49);
    
    expect(query).toBeDefined();
  });
});

describe('Auth Service', () => {
  it('should provide auth methods', () => {
    expect(typeof client.auth.getUser).toBe('function');
    expect(typeof client.auth.getSession).toBe('function');
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });
});
