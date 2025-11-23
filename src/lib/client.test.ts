/**
 * Legacy client tests
 * 
 * NOTE: This file tests the legacy Supabase client stub.
 * The actual application now uses AWS API Gateway endpoints directly via fetch.
 * These tests verify the stub works for backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import { client } from './client';

describe('Legacy Client Stub', () => {
  it('should provide a from() method for backward compatibility', () => {
    const query = client.from('tools');
    expect(query).toBeDefined();
    expect(typeof query.select).toBe('function');
  });

  it('should return promises from query methods', async () => {
    const result = await client.from('tools').select('*');
    expect(result).toBeDefined();
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('should provide auth stub methods', () => {
    expect(client.auth).toBeDefined();
    expect(typeof client.auth.getUser).toBe('function');
  });

  it('should return null user from auth stub', async () => {
    const result = await client.auth.getUser();
    expect(result.data.user).toBeNull();
    expect(result.error).toBeNull();
  });
});
