/**
 * Tests for authorizer context helper functions
 * Run with: node --test authorizerContext.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  getAuthorizerContext,
  hasPermission,
  canAccessOrganization,
  buildOrganizationFilter,
  getRoleInOrganization,
  parseJSON
} = require('./authorizerContext');

describe('getAuthorizerContext', () => {
  test('should extract context from direct authorizer', () => {
    const event = {
      requestContext: {
        authorizer: {
          organization_id: 'org-1',
          accessible_organization_ids: '["org-1","org-2"]',
          permissions: '["data:read","data:write"]',
          is_superadmin: 'false',
          user_role: 'admin'
        }
      }
    };

    const context = getAuthorizerContext(event);

    assert.strictEqual(context.organization_id, 'org-1');
    assert.deepStrictEqual(context.accessible_organization_ids, ['org-1', 'org-2']);
    assert.deepStrictEqual(context.permissions, ['data:read', 'data:write']);
    assert.strictEqual(context.is_superadmin, false);
    assert.strictEqual(context.user_role, 'admin');
  });

  test('should extract context from nested authorizer.context', () => {
    const event = {
      requestContext: {
        authorizer: {
          context: {
            organization_id: 'org-1',
            accessible_organization_ids: '["org-1"]',
            permissions: '["data:read"]',
            is_superadmin: 'false'
          }
        }
      }
    };

    const context = getAuthorizerContext(event);

    assert.strictEqual(context.organization_id, 'org-1');
    assert.deepStrictEqual(context.accessible_organization_ids, ['org-1']);
  });

  test('should handle missing authorizer gracefully', () => {
    const event = {
      requestContext: {}
    };

    const context = getAuthorizerContext(event);

    assert.strictEqual(context.organization_id, undefined);
    assert.deepStrictEqual(context.accessible_organization_ids, []);
    assert.deepStrictEqual(context.permissions, []);
  });
});

describe('hasPermission', () => {
  test('should return true for system:admin', () => {
    const context = {
      permissions: ['system:admin']
    };

    assert.strictEqual(hasPermission(context, 'data:read'), true);
    assert.strictEqual(hasPermission(context, 'organizations:create'), true);
    assert.strictEqual(hasPermission(context, 'any:permission'), true);
  });

  test('should return true if user has specific permission', () => {
    const context = {
      permissions: ['data:read', 'data:write']
    };

    assert.strictEqual(hasPermission(context, 'data:read'), true);
    assert.strictEqual(hasPermission(context, 'data:write'), true);
    assert.strictEqual(hasPermission(context, 'organizations:create'), false);
  });

  test('should return false for missing permissions', () => {
    const context = {
      permissions: []
    };

    assert.strictEqual(hasPermission(context, 'data:read'), false);
  });

  test('should handle null context', () => {
    assert.strictEqual(hasPermission(null, 'data:read'), false);
    assert.strictEqual(hasPermission(undefined, 'data:read'), false);
  });
});

describe('canAccessOrganization', () => {
  test('should allow superadmin to access any org', () => {
    const context = {
      is_superadmin: true,
      accessible_organization_ids: ['org-1']
    };

    assert.strictEqual(canAccessOrganization(context, 'org-2'), true);
    assert.strictEqual(canAccessOrganization(context, 'org-1'), true);
  });

  test('should allow system:admin to access any org', () => {
    const context = {
      is_superadmin: false,
      permissions: ['system:admin'],
      accessible_organization_ids: ['org-1']
    };

    assert.strictEqual(canAccessOrganization(context, 'org-2'), true);
  });

  test('should allow access to orgs in accessible list', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: ['org-1', 'org-2']
    };

    assert.strictEqual(canAccessOrganization(context, 'org-1'), true);
    assert.strictEqual(canAccessOrganization(context, 'org-2'), true);
    assert.strictEqual(canAccessOrganization(context, 'org-3'), false);
  });

  test('should deny access if org not in list', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: ['org-1']
    };

    assert.strictEqual(canAccessOrganization(context, 'org-2'), false);
  });
});

describe('buildOrganizationFilter', () => {
  test('should return empty condition for superadmin', () => {
    const context = {
      is_superadmin: true,
      accessible_organization_ids: ['org-1']
    };

    const filter = buildOrganizationFilter(context);

    assert.strictEqual(filter.condition, '');
    assert.deepStrictEqual(filter.params, []);
  });

  test('should return empty condition for system:admin', () => {
    const context = {
      is_superadmin: false,
      permissions: ['system:admin'],
      accessible_organization_ids: ['org-1']
    };

    const filter = buildOrganizationFilter(context);

    assert.strictEqual(filter.condition, '');
  });

  test('should build IN clause for multiple orgs', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: ['org-1', 'org-2', 'org-3']
    };

    const filter = buildOrganizationFilter(context, 't');

    assert.ok(filter.condition.includes('t.organization_id IN'));
    assert.ok(filter.condition.includes("'org-1'"));
    assert.ok(filter.condition.includes("'org-2'"));
    assert.ok(filter.condition.includes("'org-3'"));
  });

  test('should build equality for single org', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: ['org-1']
    };

    const filter = buildOrganizationFilter(context, 't');

    assert.ok(filter.condition.includes("t.organization_id = 'org-1'"));
  });

  test('should deny access if no accessible orgs', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: []
    };

    const filter = buildOrganizationFilter(context);

    assert.strictEqual(filter.condition, '1=0'); // Always false
  });

  test('should handle table alias', () => {
    const context = {
      is_superadmin: false,
      permissions: [],
      accessible_organization_ids: ['org-1']
    };

    const filter = buildOrganizationFilter(context, 'missions');

    assert.ok(filter.condition.includes('missions.organization_id'));
  });
});

describe('getRoleInOrganization', () => {
  test('should return role for specific organization', () => {
    const context = {
      organization_memberships: [
        { organization_id: 'org-1', role: 'admin' },
        { organization_id: 'org-2', role: 'viewer' }
      ]
    };

    assert.strictEqual(getRoleInOrganization(context, 'org-1'), 'admin');
    assert.strictEqual(getRoleInOrganization(context, 'org-2'), 'viewer');
  });

  test('should return null if not member of org', () => {
    const context = {
      organization_memberships: [
        { organization_id: 'org-1', role: 'admin' }
      ]
    };

    assert.strictEqual(getRoleInOrganization(context, 'org-2'), null);
  });

  test('should handle missing memberships', () => {
    const context = {
      organization_memberships: []
    };

    assert.strictEqual(getRoleInOrganization(context, 'org-1'), null);
  });
});

describe('parseJSON', () => {
  test('should parse valid JSON', () => {
    const result = parseJSON('["org-1","org-2"]', []);
    assert.deepStrictEqual(result, ['org-1', 'org-2']);
  });

  test('should return default for invalid JSON', () => {
    const result = parseJSON('invalid json', ['default']);
    assert.deepStrictEqual(result, ['default']);
  });

  test('should return default for null/undefined', () => {
    assert.deepStrictEqual(parseJSON(null, []), []);
    assert.deepStrictEqual(parseJSON(undefined, ['default']), ['default']);
  });
});

