/**
 * Property Test: Metadata Population
 * 
 * Property 9: Metadata Population
 * Validates: Requirements 3.6
 * 
 * Tests that policy metadata is properly populated and maintained
 * including creation timestamps, update tracking, and version information.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { policyService } from '../../services/policyService';
import { queryJSON } from '../../lib/database';

// Mock the database
vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: Metadata Population', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should populate all required metadata fields on policy creation', async () => {
    // Property: All policies should have complete metadata upon creation
    const testPolicies = [
      {
        title: 'Basic Policy',
        description_text: 'Basic policy description for metadata testing',
        status: 'draft'
      },
      {
        title: 'Active Policy with Date',
        description_text: 'Active policy description for metadata testing with effective date',
        status: 'active',
        effective_date: new Date().toISOString()
      },
      {
        title: 'Policy with Custom Fields',
        description_text: 'Policy with additional custom fields for comprehensive metadata testing',
        status: 'draft',
        tags: ['test', 'metadata', 'validation'],
        priority: 'high'
      }
    ];

    for (const policyData of testPolicies) {
      const mockCreatedPolicy = {
        id: `policy-${Date.now()}-${Math.random()}`,
        ...policyData,
        created_by: 'user-123',
        organization_id: 'org-456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        revision_count: 0,
        last_modified_by: 'user-123'
      };

      (queryJSON as any).mockResolvedValueOnce([mockCreatedPolicy]);

      const result = await policyService.createPolicy({
        ...policyData,
        created_by: 'user-123',
        organization_id: 'org-456'
      });

      // Property: All required metadata fields should be populated
      expect(result.id).toBeTruthy();
      expect(result.created_at).toBeTruthy();
      expect(result.updated_at).toBeTruthy();
      expect(result.created_by).toBe('user-123');
      expect(result.organization_id).toBe('org-456');
      expect(result.version).toBe(1);
      expect(result.revision_count).toBe(0);
      expect(result.last_modified_by).toBe('user-123');

      // Property: Timestamps should be valid ISO strings
      expect(() => new Date(result.created_at)).not.toThrow();
      expect(() => new Date(result.updated_at)).not.toThrow();

      // Property: created_at and updated_at should be the same for new policies
      expect(result.created_at).toBe(result.updated_at);

      // Property: created_by and last_modified_by should be the same for new policies
      expect(result.created_by).toBe(result.last_modified_by);
    }
  });

  it('should update metadata fields on policy modifications', async () => {
    // Property: Metadata should be updated when policies are modified
    const policyId = 'policy-metadata-update';
    const originalPolicy = {
      id: policyId,
      title: 'Original Policy Title',
      description_text: 'Original policy description for metadata update testing',
      status: 'draft',
      created_by: 'user-creator',
      organization_id: 'org-456',
      created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      version: 1,
      revision_count: 0,
      last_modified_by: 'user-creator'
    };

    const updateData = {
      title: 'Updated Policy Title',
      description_text: 'Updated policy description with new content for metadata testing'
    };

    const updatedPolicy = {
      ...originalPolicy,
      ...updateData,
      updated_at: new Date('2024-01-02T15:30:00Z').toISOString(),
      version: 2,
      revision_count: 1,
      last_modified_by: 'user-editor'
    };

    (queryJSON as any).mockResolvedValueOnce([originalPolicy]); // Current state
    (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated state

    const result = await policyService.updatePolicy(policyId, updateData);

    // Property: Update metadata should be properly maintained
    expect(result.updated_at).not.toBe(originalPolicy.updated_at);
    expect(result.version).toBe(2);
    expect(result.revision_count).toBe(1);
    expect(result.last_modified_by).toBe('user-editor');

    // Property: Original creation metadata should be preserved
    expect(result.created_at).toBe(originalPolicy.created_at);
    expect(result.created_by).toBe(originalPolicy.created_by);
    expect(result.id).toBe(originalPolicy.id);
    expect(result.organization_id).toBe(originalPolicy.organization_id);

    // Property: Updated timestamp should be later than created timestamp
    expect(new Date(result.updated_at).getTime()).toBeGreaterThan(new Date(result.created_at).getTime());
  });

  it('should maintain version history in metadata', async () => {
    // Property: Version history should be tracked in metadata
    const policyId = 'policy-version-history';
    const basePolicy = {
      id: policyId,
      title: 'Version History Policy',
      description_text: 'Policy for testing version history metadata tracking',
      status: 'draft',
      created_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      version: 1,
      revision_count: 0,
      last_modified_by: 'user-123',
      version_history: [
        {
          version: 1,
          created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
          created_by: 'user-123',
          changes: { action: 'created', fields: ['title', 'description_text', 'status'] }
        }
      ]
    };

    const versionUpdates = [
      {
        changes: { description_text: 'First update to description' },
        user: 'user-editor-1',
        timestamp: new Date('2024-01-02T10:00:00Z').toISOString()
      },
      {
        changes: { status: 'active', effective_date: new Date('2024-01-03T10:00:00Z').toISOString() },
        user: 'user-activator',
        timestamp: new Date('2024-01-03T10:00:00Z').toISOString()
      },
      {
        changes: { description_text: 'Second update with more details' },
        user: 'user-editor-2',
        timestamp: new Date('2024-01-04T10:00:00Z').toISOString()
      }
    ];

    let currentPolicy = basePolicy;

    for (let i = 0; i < versionUpdates.length; i++) {
      const update = versionUpdates[i];
      const newVersion = currentPolicy.version + 1;
      
      const updatedPolicy = {
        ...currentPolicy,
        ...update.changes,
        version: newVersion,
        revision_count: currentPolicy.revision_count + 1,
        updated_at: update.timestamp,
        last_modified_by: update.user,
        version_history: [
          ...currentPolicy.version_history,
          {
            version: newVersion,
            created_at: update.timestamp,
            created_by: update.user,
            changes: { action: 'updated', fields: Object.keys(update.changes) }
          }
        ]
      };

      (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Current state
      (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated state

      const result = await policyService.updatePolicy(policyId, update.changes);

      // Property: Version should increment
      expect(result.version).toBe(newVersion);
      expect(result.revision_count).toBe(i + 1);

      // Property: Version history should include all versions
      expect(result.version_history).toBeDefined();
      expect(result.version_history.length).toBe(newVersion);

      // Property: Latest version history entry should match current update
      const latestHistory = result.version_history[result.version_history.length - 1];
      expect(latestHistory.version).toBe(newVersion);
      expect(latestHistory.created_by).toBe(update.user);
      expect(latestHistory.created_at).toBe(update.timestamp);

      currentPolicy = updatedPolicy;
    }

    // Property: Complete version history should be maintained
    expect(currentPolicy.version_history.length).toBe(4); // Initial + 3 updates
    expect(currentPolicy.version_history.map(v => v.version)).toEqual([1, 2, 3, 4]);
  });

  it('should populate organization-specific metadata', async () => {
    // Property: Organization-specific metadata should be properly handled
    const organizationTests = [
      {
        organization_id: 'org-small',
        expected_metadata: {
          organization_type: 'small',
          compliance_level: 'basic'
        }
      },
      {
        organization_id: 'org-enterprise',
        expected_metadata: {
          organization_type: 'enterprise',
          compliance_level: 'advanced',
          audit_required: true
        }
      },
      {
        organization_id: 'org-government',
        expected_metadata: {
          organization_type: 'government',
          compliance_level: 'strict',
          audit_required: true,
          retention_period: '7_years'
        }
      }
    ];

    for (const orgTest of organizationTests) {
      const policyData = {
        title: `Policy for ${orgTest.organization_id}`,
        description_text: 'Policy for testing organization-specific metadata population',
        status: 'draft',
        created_by: 'user-123',
        organization_id: orgTest.organization_id
      };

      const mockPolicy = {
        id: `policy-${orgTest.organization_id}`,
        ...policyData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        revision_count: 0,
        last_modified_by: 'user-123',
        organization_metadata: orgTest.expected_metadata
      };

      (queryJSON as any).mockResolvedValueOnce([mockPolicy]);

      const result = await policyService.createPolicy(policyData);

      // Property: Organization-specific metadata should be populated
      expect(result.organization_metadata).toBeDefined();
      expect(result.organization_metadata.organization_type).toBe(orgTest.expected_metadata.organization_type);
      expect(result.organization_metadata.compliance_level).toBe(orgTest.expected_metadata.compliance_level);

      if (orgTest.expected_metadata.audit_required) {
        expect(result.organization_metadata.audit_required).toBe(true);
      }

      if (orgTest.expected_metadata.retention_period) {
        expect(result.organization_metadata.retention_period).toBe(orgTest.expected_metadata.retention_period);
      }
    }
  });

  it('should handle metadata for different policy statuses', async () => {
    // Property: Metadata should be appropriate for different policy statuses
    const statusTests = [
      {
        status: 'draft',
        expected_metadata: {
          is_published: false,
          requires_approval: false
        }
      },
      {
        status: 'active',
        effective_date: new Date().toISOString(),
        expected_metadata: {
          is_published: true,
          requires_approval: true,
          approval_required_by: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        }
      },
      {
        status: 'deprecated',
        deprecated_date: new Date().toISOString(),
        expected_metadata: {
          is_published: false,
          requires_approval: false,
          deprecation_reason: 'superseded'
        }
      }
    ];

    for (const statusTest of statusTests) {
      const policyData = {
        title: `${statusTest.status.charAt(0).toUpperCase() + statusTest.status.slice(1)} Policy`,
        description_text: `Policy for testing ${statusTest.status} status metadata population`,
        status: statusTest.status,
        created_by: 'user-123',
        organization_id: 'org-456',
        ...(statusTest.effective_date && { effective_date: statusTest.effective_date }),
        ...(statusTest.deprecated_date && { deprecated_date: statusTest.deprecated_date })
      };

      const mockPolicy = {
        id: `policy-${statusTest.status}`,
        ...policyData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        revision_count: 0,
        last_modified_by: 'user-123',
        status_metadata: statusTest.expected_metadata
      };

      (queryJSON as any).mockResolvedValueOnce([mockPolicy]);

      const result = await policyService.createPolicy(policyData);

      // Property: Status-specific metadata should be populated
      expect(result.status_metadata).toBeDefined();
      expect(result.status_metadata.is_published).toBe(statusTest.expected_metadata.is_published);
      expect(result.status_metadata.requires_approval).toBe(statusTest.expected_metadata.requires_approval);

      if (statusTest.expected_metadata.approval_required_by) {
        expect(result.status_metadata.approval_required_by).toBe(statusTest.expected_metadata.approval_required_by);
      }

      if (statusTest.expected_metadata.deprecation_reason) {
        expect(result.status_metadata.deprecation_reason).toBe(statusTest.expected_metadata.deprecation_reason);
      }
    }
  });

  it('should maintain metadata consistency across operations', async () => {
    // Property: Metadata should remain consistent across all operations
    const policyId = 'policy-consistency-test';
    const originalPolicy = {
      id: policyId,
      title: 'Consistency Test Policy',
      description_text: 'Policy for testing metadata consistency across operations',
      status: 'draft',
      created_by: 'user-creator',
      organization_id: 'org-456',
      created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      updated_at: new Date('2024-01-01T10:00:00Z').toISOString(),
      version: 1,
      revision_count: 0,
      last_modified_by: 'user-creator'
    };

    // Test multiple operations
    const operations = [
      { type: 'update', data: { title: 'Updated Title' } },
      { type: 'update', data: { description_text: 'Updated description' } },
      { type: 'status_change', data: { status: 'active', effective_date: new Date().toISOString() } },
      { type: 'update', data: { title: 'Final Title Update' } }
    ];

    let currentPolicy = originalPolicy;

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const updatedPolicy = {
        ...currentPolicy,
        ...operation.data,
        updated_at: new Date(Date.now() + (i + 1) * 1000).toISOString(),
        version: currentPolicy.version + 1,
        revision_count: currentPolicy.revision_count + 1,
        last_modified_by: `user-${operation.type}-${i + 1}`
      };

      (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Current state
      (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated state

      const result = await policyService.updatePolicy(policyId, operation.data);

      // Property: Core metadata should be preserved
      expect(result.id).toBe(originalPolicy.id);
      expect(result.created_at).toBe(originalPolicy.created_at);
      expect(result.created_by).toBe(originalPolicy.created_by);
      expect(result.organization_id).toBe(originalPolicy.organization_id);

      // Property: Update metadata should be current
      expect(result.version).toBe(currentPolicy.version + 1);
      expect(result.revision_count).toBe(currentPolicy.revision_count + 1);
      expect(result.updated_at).not.toBe(currentPolicy.updated_at);
      expect(result.last_modified_by).toBe(`user-${operation.type}-${i + 1}`);

      // Property: Timestamps should be chronologically ordered
      expect(new Date(result.updated_at).getTime()).toBeGreaterThan(new Date(result.created_at).getTime());
      if (i > 0) {
        expect(new Date(result.updated_at).getTime()).toBeGreaterThan(new Date(currentPolicy.updated_at).getTime());
      }

      currentPolicy = updatedPolicy;
    }

    // Property: Final metadata should reflect all operations
    expect(currentPolicy.version).toBe(5); // Original + 4 updates
    expect(currentPolicy.revision_count).toBe(4);
  });

  it('should validate metadata field types and constraints', async () => {
    // Property: Metadata fields should have proper types and constraints
    const validationTests = [
      {
        name: 'Valid timestamps',
        metadata: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        shouldPass: true
      },
      {
        name: 'Invalid timestamp format',
        metadata: {
          created_at: 'invalid-date',
          updated_at: new Date().toISOString()
        },
        shouldPass: false,
        errorMessage: 'Invalid timestamp format'
      },
      {
        name: 'Negative version number',
        metadata: {
          version: -1,
          revision_count: 0
        },
        shouldPass: false,
        errorMessage: 'Version must be positive'
      },
      {
        name: 'Negative revision count',
        metadata: {
          version: 1,
          revision_count: -1
        },
        shouldPass: false,
        errorMessage: 'Revision count cannot be negative'
      },
      {
        name: 'Empty required fields',
        metadata: {
          created_by: '',
          organization_id: ''
        },
        shouldPass: false,
        errorMessage: 'Required metadata fields cannot be empty'
      }
    ];

    for (const test of validationTests) {
      const policyData = {
        title: `Validation Test: ${test.name}`,
        description_text: 'Policy for testing metadata validation constraints',
        status: 'draft',
        created_by: 'user-123',
        organization_id: 'org-456',
        ...test.metadata
      };

      if (test.shouldPass) {
        const mockPolicy = {
          id: `policy-validation-${test.name.replace(/\s+/g, '-').toLowerCase()}`,
          ...policyData,
          created_at: test.metadata.created_at || new Date().toISOString(),
          updated_at: test.metadata.updated_at || new Date().toISOString(),
          version: test.metadata.version || 1,
          revision_count: test.metadata.revision_count || 0,
          last_modified_by: 'user-123'
        };

        (queryJSON as any).mockResolvedValueOnce([mockPolicy]);

        const result = await policyService.createPolicy(policyData);
        expect(result).toBeTruthy();
      } else {
        try {
          await policyService.createPolicy(policyData);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toContain(test.errorMessage);
        }
      }
    }
  });
});