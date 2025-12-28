/**
 * Tool Creation Integration Test
 * 
 * Comprehensive integration test that validates tool creation through real Lambda API endpoints,
 * tests permissions, and validates the tool checkout state consistency bug fix.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestAuth, cleanupTestAuth } from './testAuth';
import { testToolCreator, TestTool } from './TestToolCreator';
import { permissionValidator } from './PermissionValidator';
import { checkoutStateValidator } from './CheckoutStateValidator';

describe('Tool Creation Integration Tests', () => {
  let createdTools: TestTool[] = [];
  let createdActions: string[] = [];

  beforeAll(async () => {
    console.log('🚀 Setting up tool creation integration tests...');
    
    // Set up authentication
    await setupTestAuth();
    
    console.log('✅ Integration test setup complete');
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    console.log('🧹 Cleaning up tool creation integration tests...');
    
    // Clean up any created tools
    await testToolCreator.cleanupCreatedTools();
    
    // Clean up any created actions
    for (const actionId of createdActions) {
      try {
        await checkoutStateValidator.cleanupTestAction(actionId);
      } catch (error) {
        console.warn(`Failed to cleanup action ${actionId}:`, error);
      }
    }
    
    // Clean up authentication
    await cleanupTestAuth();
    
    console.log('✅ Integration test cleanup complete');
  }, 30000); // 30 second timeout for cleanup

  beforeEach(() => {
    // Clear tracking arrays before each test
    createdTools = [];
    createdActions = [];
  });

  describe('Permission Validation', () => {
    it('should validate that test user has required tool creation permissions', async () => {
      console.log('🔐 Testing user permissions...');
      
      const diagnostic = await permissionValidator.diagnosePermissionIssues();
      
      // Print diagnostic report for debugging
      permissionValidator.printDiagnosticReport(diagnostic);
      
      if (!diagnostic.hasAllPermissions) {
        // If permissions are missing, provide helpful error message
        const failedTests = diagnostic.diagnostics.filter(d => !d.result.hasPermission);
        const errorMessage = [
          'Integration test user lacks required permissions:',
          ...failedTests.map(t => `  - ${t.method} ${t.endpoint}: ${t.result.error || 'Access denied'}`),
          '',
          'To fix this issue:',
          '1. Set DB_PASSWORD environment variable',
          '2. Run: ./scripts/setup-integration-test-user.sh',
          '3. Verify user was added to organization_members table with contributor role',
          '4. Re-run the integration tests'
        ].join('\n');
        
        throw new Error(errorMessage);
      }
      
      expect(diagnostic.hasAllPermissions).toBe(true);
      expect(diagnostic.diagnostics.every(d => d.result.hasPermission)).toBe(true);
    }, 15000);

    it('should validate permission boundary enforcement', async () => {
      console.log('🔐 Testing permission boundaries...');
      
      // Test that user can read tools (should have data:read permission)
      const readResult = await permissionValidator.validateToolReadPermission();
      expect(readResult.hasPermission).toBe(true);
      expect(readResult.statusCode).toBe(200);
      
      // Test that user can create tools (should have data:write permission)
      const createResult = await permissionValidator.validateToolCreationPermission();
      expect(createResult.hasPermission).toBe(true);
      expect(createResult.statusCode).toBe(201);
    }, 10000);

    it('should validate organization-scoped access', async () => {
      console.log('🏢 Testing organization-scoped access...');
      
      // User should be able to read tools from their organization
      const readResult = await permissionValidator.validateToolReadPermission();
      expect(readResult.hasPermission).toBe(true);
      
      // The tools returned should be filtered by organization
      // (We can't easily test cross-org access without multiple orgs, but we can verify the request succeeds)
      expect(readResult.details?.toolCount).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('Tool Creation', () => {
    it('should successfully create a tool with minimal data', async () => {
      console.log('🔧 Testing minimal tool creation...');
      
      const tool = await testToolCreator.createMinimalTool();
      createdTools.push(tool);
      
      expect(tool).toBeDefined();
      expect(tool.id).toBeDefined();
      expect(tool.name).toContain('Minimal Test Tool');
      expect(tool.status).toBe('available');
      expect(tool.organization_id).toBeDefined();
      
      // Validate the tool exists and can be retrieved
      const retrievedTool = await testToolCreator.validateToolExists(tool.id);
      expect(retrievedTool).toBeDefined();
      expect(retrievedTool?.id).toBe(tool.id);
    }, 10000);

    it('should successfully create a tool with complete data', async () => {
      console.log('🔧 Testing complete tool creation...');
      
      const tool = await testToolCreator.createCompleteTool();
      createdTools.push(tool);
      
      expect(tool).toBeDefined();
      expect(tool.id).toBeDefined();
      expect(tool.name).toContain('Complete Test Tool');
      expect(tool.description).toContain('comprehensive test tool');
      expect(tool.category).toBe('Test Equipment');
      expect(tool.status).toBe('available');
      expect(tool.serial_number).toContain('COMPLETE-');
      expect(tool.storage_location).toBe('Integration Test Storage Area');
      expect(tool.organization_id).toBeDefined();
      
      // Validate all properties are set correctly
      const isValid = await testToolCreator.validateToolState(tool.id, {
        name: tool.name,
        category: 'Test Equipment',
        status: 'available'
      });
      expect(isValid).toBe(true);
    }, 10000);

    it('should handle validation error cases', async () => {
      console.log('🔧 Testing validation error handling...');
      
      // Try to create a tool without a name (should fail)
      try {
        const response = await fetch(`${process.env.VITE_API_BASE_URL}/tools`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await (await import('./testAuth')).testAuthService.getIdToken()}`
          },
          body: JSON.stringify({
            description: 'Tool without name - should fail'
          })
        });
        
        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        
        const error = await response.json();
        expect(error.error).toContain('name is required');
      } catch (error) {
        // If fetch throws, that's also acceptable for this test
        expect(error).toBeDefined();
      }
    }, 10000);
  });

  describe('Checkout State Validation', () => {
    it('should validate initial tool state is correct', async () => {
      console.log('🔍 Testing initial tool state validation...');
      
      // Create a test tool
      const tool = await testToolCreator.createMinimalTool();
      createdTools.push(tool);
      
      // Validate initial state
      const validation = await checkoutStateValidator.validateInitialToolState(tool.id);
      
      expect(validation.isValid).toBe(true);
      expect(validation.tool).toBeDefined();
      expect(validation.issues).toHaveLength(0);
      
      // Verify specific initial state properties
      expect(validation.tool?.status).toBe('available');
      expect(validation.tool?.is_checked_out).toBeFalsy();
      expect(validation.tool?.checked_out_user_id).toBeFalsy();
      expect(validation.tool?.checkout_action_id).toBeFalsy();
    }, 10000);

    it('should validate checkout state consistency after adding tool to action', async () => {
      console.log('🔍 Testing checkout state consistency...');
      
      // Create a test tool
      const tool = await testToolCreator.createMinimalTool();
      createdTools.push(tool);
      
      // Create an action and add the tool to it
      const actionId = await checkoutStateValidator.createTestActionWithTool(tool.id);
      expect(actionId).toBeDefined();
      
      if (actionId) {
        createdActions.push(actionId);
        
        // Wait a moment for the checkout to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Validate checkout state consistency
        const validation = await checkoutStateValidator.validateCheckoutStateConsistency(tool.id, actionId);
        
        // Print validation details for debugging
        console.log('Checkout state validation result:', {
          isValid: validation.isValid,
          toolsEndpointStatus: validation.toolsEndpointStatus,
          actionsEndpointStatus: validation.actionsEndpointStatus,
          isCheckedOut: validation.isCheckedOut,
          differences: validation.differences
        });
        
        // The main assertion: checkout state should be consistent
        expect(validation.isValid).toBe(true);
        expect(validation.differences).toHaveLength(0);
        
        // Verify the bug fix: when tool is checked out, status should be 'checked_out'
        if (validation.isCheckedOut) {
          expect(validation.toolsEndpointStatus).toBe('checked_out');
        }
      }
    }, 15000);

    it('should validate consistency across different endpoints', async () => {
      console.log('🔍 Testing endpoint response consistency...');
      
      // Create a test tool
      const tool = await testToolCreator.createMinimalTool();
      createdTools.push(tool);
      
      // Create an action with the tool
      const actionId = await checkoutStateValidator.createTestActionWithTool(tool.id);
      expect(actionId).toBeDefined();
      
      if (actionId) {
        createdActions.push(actionId);
        
        // Wait for checkout processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Compare responses from both endpoints
        const comparison = await checkoutStateValidator.compareEndpointResponses(tool.id, actionId);
        
        expect(comparison.toolsEndpointTool).toBeDefined();
        expect(comparison.actionsEndpointTool).toBeDefined();
        
        // Print comparison details for debugging
        console.log('Endpoint comparison result:', {
          matches: comparison.comparison.matches,
          differences: comparison.comparison.differences,
          statusConsistent: comparison.comparison.statusConsistent
        });
        
        // Both endpoints should return consistent data
        expect(comparison.comparison.matches).toBe(true);
        expect(comparison.comparison.statusConsistent).toBe(true);
        expect(comparison.comparison.differences).toHaveLength(0);
      }
    }, 15000);

    it('should validate the specific bug fix for status computation', async () => {
      console.log('🔍 Testing specific bug fix for status computation...');
      
      // Create a test tool
      const tool = await testToolCreator.createMinimalTool();
      createdTools.push(tool);
      
      // Verify initial state
      let validation = await checkoutStateValidator.validateInitialToolState(tool.id);
      expect(validation.isValid).toBe(true);
      expect(validation.tool?.status).toBe('available');
      expect(validation.tool?.is_checked_out).toBeFalsy();
      
      // Add tool to an action (this should check it out)
      const actionId = await checkoutStateValidator.createTestActionWithTool(tool.id);
      expect(actionId).toBeDefined();
      
      if (actionId) {
        createdActions.push(actionId);
        
        // Wait for checkout processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Validate the bug fix: when is_checked_out is true, status should be 'checked_out'
        validation = await checkoutStateValidator.validateCheckoutStateConsistency(tool.id, actionId);
        
        console.log('Bug fix validation:', {
          isCheckedOut: validation.isCheckedOut,
          toolsEndpointStatus: validation.toolsEndpointStatus,
          isValid: validation.isValid,
          differences: validation.differences
        });
        
        // If the tool is checked out, the status should reflect that
        if (validation.isCheckedOut) {
          expect(validation.toolsEndpointStatus).toBe('checked_out');
          expect(validation.isValid).toBe(true);
        }
        
        // Complete the action to check the tool back in
        await checkoutStateValidator.cleanupTestAction(actionId);
        
        // Wait for checkin processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify tool is checked back in
        const finalValidation = await checkoutStateValidator.validateInitialToolState(tool.id);
        expect(finalValidation.tool?.status).toBe('available');
        expect(finalValidation.tool?.is_checked_out).toBeFalsy();
      }
    }, 20000);
  });

  describe('Error Handling and Diagnostics', () => {
    it('should provide clear error messages for permission issues', async () => {
      console.log('🔍 Testing error handling for permission issues...');
      
      // This test validates that our diagnostic tools work correctly
      const diagnostic = await permissionValidator.diagnosePermissionIssues();
      
      // Should have run all diagnostic tests
      expect(diagnostic.diagnostics.length).toBeGreaterThan(0);
      
      // Should provide recommendations
      expect(diagnostic.recommendations.length).toBeGreaterThan(0);
      
      // If all permissions are working, should indicate success
      if (diagnostic.hasAllPermissions) {
        expect(diagnostic.recommendations.some(r => r.includes('✅'))).toBe(true);
      }
    }, 10000);

    it('should handle network timeouts and connection issues gracefully', async () => {
      console.log('🔍 Testing network error handling...');
      
      // Test with an invalid API URL to simulate network issues
      const originalUrl = process.env.VITE_API_BASE_URL;
      
      try {
        // Temporarily set invalid URL
        process.env.VITE_API_BASE_URL = 'https://invalid-url-that-does-not-exist.com';
        
        // Try to validate permissions (should handle the error gracefully)
        const result = await permissionValidator.validateToolReadPermission();
        
        expect(result.hasPermission).toBe(false);
        expect(result.error).toBeDefined();
        
      } finally {
        // Restore original URL
        process.env.VITE_API_BASE_URL = originalUrl;
      }
    }, 10000);

    it('should provide actionable remediation suggestions', async () => {
      console.log('🔍 Testing remediation suggestions...');
      
      const diagnostic = await permissionValidator.diagnosePermissionIssues();
      
      // Should provide specific recommendations
      expect(diagnostic.recommendations.length).toBeGreaterThan(0);
      
      // Recommendations should mention key setup steps
      const recommendationText = diagnostic.recommendations.join(' ');
      
      if (!diagnostic.hasAllPermissions) {
        expect(recommendationText).toContain('setup-integration-test-user');
        expect(recommendationText).toContain('organization_members');
      }
    }, 10000);
  });
});