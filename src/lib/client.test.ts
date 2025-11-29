/**
 * Legacy client tests
 * 
 * NOTE: This file tests that the deprecated Supabase client throws errors.
 * The actual application now uses AWS API Gateway endpoints directly via fetch.
 * These tests verify that attempts to use the old Supabase client are properly blocked.
 */

import { describe, it, expect } from 'vitest';
import { client, supabase } from './client';

describe('Legacy Client Stub', () => {
  it('should throw error when accessing client.from()', () => {
    expect(() => {
      // @ts-expect-error - Testing deprecated API
      client.from('tools');
    }).toThrow('Supabase client is no longer available. Use AWS Cognito (useCognitoAuth) for auth and apiService for API calls.');
  });

  it('should throw error when accessing client.auth', () => {
    expect(() => {
      // @ts-expect-error - Testing deprecated API
      client.auth;
    }).toThrow('Supabase client is no longer available. Use AWS Cognito (useCognitoAuth) for auth and apiService for API calls.');
  });

  it('should throw error when accessing supabase directly', () => {
    expect(() => {
      // @ts-expect-error - Testing deprecated API
      supabase.from('tools');
    }).toThrow('Supabase client is no longer available. Use AWS Cognito (useCognitoAuth) for auth and apiService for API calls.');
  });

  it('should throw error when accessing supabase.auth', () => {
    expect(() => {
      // @ts-expect-error - Testing deprecated API
      supabase.auth;
    }).toThrow('Supabase client is no longer available. Use AWS Cognito (useCognitoAuth) for auth and apiService for API calls.');
  });
});
