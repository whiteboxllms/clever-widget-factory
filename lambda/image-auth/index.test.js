/**
 * Unit tests for CloudFront Cookie Generator Lambda
 * 
 * Tests cover:
 * - Organization ID extraction
 * - CloudFront policy generation
 * - Policy signing
 * - Error handling
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// Set environment variables for tests
process.env.CLOUDFRONT_DOMAIN = 'd1234567890.cloudfront.net';
process.env.CLOUDFRONT_KEY_PAIR_ID = 'APKATEST123456';
process.env.CLOUDFRONT_PRIVATE_KEY_SECRET_NAME = 'test-private-key';
process.env.COOKIE_EXPIRATION_SECONDS = '3600';
process.env.AWS_REGION = 'us-west-2';

// Import the module
const { buildCloudFrontPolicy, signPolicy, extractOrganizationId } = await import('./index.js');

describe('CloudFront Cookie Generator Lambda', () => {
  
  describe('extractOrganizationId', () => {
    it('should extract organization_id from custom claims', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              'custom:organization_id': 'org-123-456',
              sub: 'user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const orgId = extractOrganizationId(event);
      expect(orgId).toBe('org-123-456');
    });

    it('should extract organization_id from standard claims', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              organization_id: 'org-789-012',
              sub: 'user-456'
            }
          }
        }
      };

      const orgId = extractOrganizationId(event);
      expect(orgId).toBe('org-789-012');
    });

    it('should return null when authorizer claims are missing', () => {
      const event = {
        requestContext: {}
      };

      const orgId = extractOrganizationId(event);
      expect(orgId).toBeNull();
    });

    it('should return null when organization_id is not in claims', () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: 'user-123',
              email: 'test@example.com'
            }
          }
        }
      };

      const orgId = extractOrganizationId(event);
      expect(orgId).toBeNull();
    });
  });

  describe('buildCloudFrontPolicy', () => {
    it('should build policy with organization-scoped resource path', () => {
      const organizationId = 'org-123-456';
      const expirationTime = 1705320000;

      const policy = buildCloudFrontPolicy(organizationId, expirationTime);

      expect(policy).toEqual({
        Statement: [
          {
            Resource: 'https://d1234567890.cloudfront.net/organizations/org-123-456/*',
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': 1705320000
              }
            }
          }
        ]
      });
    });

    it('should include wildcard for all images in organization', () => {
      const organizationId = 'org-abc-def';
      const expirationTime = 1705320000;

      const policy = buildCloudFrontPolicy(organizationId, expirationTime);

      expect(policy.Statement[0].Resource).toContain('/organizations/org-abc-def/*');
    });

    it('should use correct CloudFront domain from environment', () => {
      const organizationId = 'org-test';
      const expirationTime = 1705320000;

      const policy = buildCloudFrontPolicy(organizationId, expirationTime);

      expect(policy.Statement[0].Resource).toContain('d1234567890.cloudfront.net');
    });
  });

  describe('signPolicy', () => {
    it('should sign policy using RSA-SHA1', () => {
      // Generate test RSA key pair
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs1',
          format: 'pem'
        },
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem'
        }
      });

      const policy = {
        Statement: [
          {
            Resource: 'https://d1234567890.cloudfront.net/organizations/org-123/*',
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': 1705320000
              }
            }
          }
        ]
      };

      const signature = signPolicy(policy, privateKey);

      // Signature should be URL-safe base64
      expect(signature).toMatch(/^[A-Za-z0-9\-_~]+$/);
      expect(signature).not.toContain('+');
      expect(signature).not.toContain('=');
      expect(signature).not.toContain('/');
    });

    it('should produce consistent signatures for same policy', () => {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: {
          type: 'pkcs1',
          format: 'pem'
        },
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem'
        }
      });

      const policy = {
        Statement: [
          {
            Resource: 'https://d1234567890.cloudfront.net/organizations/org-123/*',
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': 1705320000
              }
            }
          }
        ]
      };

      const signature1 = signPolicy(policy, privateKey);
      const signature2 = signPolicy(policy, privateKey);

      expect(signature1).toBe(signature2);
    });

    it('should throw error for invalid private key', () => {
      const policy = {
        Statement: [
          {
            Resource: 'https://d1234567890.cloudfront.net/organizations/org-123/*',
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': 1705320000
              }
            }
          }
        ]
      };

      expect(() => {
        signPolicy(policy, 'invalid-key');
      }).toThrow();
    });
  });
});
