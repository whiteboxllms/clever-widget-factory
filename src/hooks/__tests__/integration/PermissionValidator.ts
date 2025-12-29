/**
 * PermissionValidator - Validates user permissions for integration tests
 * 
 * This class provides functionality to test and diagnose permission issues
 * when working with the Lambda API endpoints using the same apiService as the frontend.
 */

import { testAuthService } from './testAuth';
import { apiService, getApiData } from '@/lib/apiService';

export interface PermissionTestResult {
  hasPermission: boolean;
  statusCode?: number;
  error?: string;
  details?: any;
}

export interface PermissionDiagnostic {
  endpoint: string;
  method: string;
  expectedPermission: string;
  result: PermissionTestResult;
  recommendation?: string;
}

export class PermissionValidator {
  constructor() {
    // No need to store API base URL since apiService handles this
  }

  /**
   * Test if user has permission to create tools
   */
  async validateToolCreationPermission(): Promise<PermissionTestResult> {
    try {
      console.log('🔐 Testing tool creation permission...');
      
      // Try to create a minimal test tool
      const testToolData = {
        name: `Permission Test Tool ${Date.now()}`,
        description: 'Test tool for permission validation - will be deleted',
        category: 'Test Equipment'
      };

      try {
        const response = await apiService.post('/tools', testToolData);
        const createdTool = getApiData(response);
        const toolId = createdTool?.id;
        
        // Clean up the test tool immediately
        if (toolId) {
          try {
            await apiService.put(`/tools/${toolId}`, { status: 'removed' });
            console.log('🧹 Cleaned up permission test tool');
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup permission test tool:', cleanupError);
          }
        }

        console.log('✅ Tool creation permission: GRANTED');
        return {
          hasPermission: true,
          statusCode: 201,
          details: { toolId }
        };
      } catch (error: any) {
        console.log('❌ Tool creation permission: DENIED');
        return {
          hasPermission: false,
          statusCode: error.status,
          error: error.message,
          details: { error: error.error }
        };
      }
    } catch (error: any) {
      console.error('❌ Permission validation error:', error);
      return {
        hasPermission: false,
        error: error.message,
        details: { error }
      };
    }
  }

  /**
   * Test if user has permission to read tools
   */
  async validateToolReadPermission(): Promise<PermissionTestResult> {
    try {
      console.log('🔐 Testing tool read permission...');
      
      try {
        const response = await apiService.get('/tools');
        const tools = getApiData(response);
        
        console.log('✅ Tool read permission: GRANTED');
        return {
          hasPermission: true,
          statusCode: 200,
          details: { toolCount: tools?.length || 0 }
        };
      } catch (error: any) {
        console.log('❌ Tool read permission: DENIED');
        return {
          hasPermission: false,
          statusCode: error.status,
          error: error.message
        };
      }
    } catch (error: any) {
      console.error('❌ Read permission validation error:', error);
      return {
        hasPermission: false,
        error: error.message
      };
    }
  }

  /**
   * Test if user has permission to update tools
   */
  async validateToolUpdatePermission(toolId: string): Promise<PermissionTestResult> {
    try {
      console.log('🔐 Testing tool update permission...');
      
      try {
        // Try to update a tool's description (non-destructive change)
        await apiService.put(`/tools/${toolId}`, {
          description: `Updated by permission test at ${new Date().toISOString()}`
        });

        console.log('✅ Tool update permission: GRANTED');
        return {
          hasPermission: true,
          statusCode: 200
        };
      } catch (error: any) {
        console.log('❌ Tool update permission: DENIED');
        return {
          hasPermission: false,
          statusCode: error.status,
          error: error.message
        };
      }
    } catch (error: any) {
      console.error('❌ Update permission validation error:', error);
      return {
        hasPermission: false,
        error: error.message
      };
    }
  }

  /**
   * Test if user has permission to delete tools (mark as removed)
   */
  async validateToolDeletePermission(toolId: string): Promise<PermissionTestResult> {
    try {
      console.log('🔐 Testing tool delete permission...');
      
      try {
        // Try to mark tool as removed
        await apiService.put(`/tools/${toolId}`, {
          status: 'removed'
        });

        console.log('✅ Tool delete permission: GRANTED');
        return {
          hasPermission: true,
          statusCode: 200
        };
      } catch (error: any) {
        console.log('❌ Tool delete permission: DENIED');
        return {
          hasPermission: false,
          statusCode: error.status,
          error: error.message
        };
      }
    } catch (error: any) {
      console.error('❌ Delete permission validation error:', error);
      return {
        hasPermission: false,
        error: error.message
      };
    }
  }

  /**
   * Run comprehensive permission tests
   */
  async runComprehensivePermissionTest(): Promise<PermissionDiagnostic[]> {
    console.log('🔐 Running comprehensive permission tests...');
    
    const diagnostics: PermissionDiagnostic[] = [];

    // Test read permission
    const readResult = await this.validateToolReadPermission();
    diagnostics.push({
      endpoint: '/tools',
      method: 'GET',
      expectedPermission: 'data:read',
      result: readResult,
      recommendation: readResult.hasPermission 
        ? 'Read permission is working correctly'
        : 'User needs data:read permission. Check organization membership and role.'
    });

    // Test create permission
    const createResult = await this.validateToolCreationPermission();
    diagnostics.push({
      endpoint: '/tools',
      method: 'POST',
      expectedPermission: 'data:write',
      result: createResult,
      recommendation: createResult.hasPermission
        ? 'Create permission is working correctly'
        : 'User needs data:write permission. Ensure user has contributor, leadership, or admin role.'
    });

    // If we can create tools, test update and delete with a test tool
    if (createResult.hasPermission && createResult.details?.toolId) {
      const toolId = createResult.details.toolId;
      
      const updateResult = await this.validateToolUpdatePermission(toolId);
      diagnostics.push({
        endpoint: `/tools/${toolId}`,
        method: 'PUT',
        expectedPermission: 'data:write',
        result: updateResult,
        recommendation: updateResult.hasPermission
          ? 'Update permission is working correctly'
          : 'User needs data:write permission for updates.'
      });

      const deleteResult = await this.validateToolDeletePermission(toolId);
      diagnostics.push({
        endpoint: `/tools/${toolId}`,
        method: 'PUT (delete)',
        expectedPermission: 'data:write',
        result: deleteResult,
        recommendation: deleteResult.hasPermission
          ? 'Delete permission is working correctly'
          : 'User needs data:write permission for deletions.'
      });
    }

    return diagnostics;
  }

  /**
   * Diagnose permission issues and provide actionable recommendations
   */
  async diagnosePermissionIssues(): Promise<{
    hasAllPermissions: boolean;
    diagnostics: PermissionDiagnostic[];
    recommendations: string[];
  }> {
    console.log('🔍 Diagnosing permission issues...');
    
    const diagnostics = await this.runComprehensivePermissionTest();
    const failedTests = diagnostics.filter(d => !d.result.hasPermission);
    const hasAllPermissions = failedTests.length === 0;
    
    const recommendations: string[] = [];
    
    if (!hasAllPermissions) {
      recommendations.push('❌ Permission issues detected:');
      
      // Analyze common failure patterns
      const has403Errors = failedTests.some(d => d.result.statusCode === 403);
      const has401Errors = failedTests.some(d => d.result.statusCode === 401);
      
      if (has401Errors) {
        recommendations.push('🔐 Authentication issue: Check that the test user exists in Cognito and credentials are correct');
        recommendations.push('   - Verify INTEGRATION_TEST_USERNAME and INTEGRATION_TEST_PASSWORD in .env.test');
        recommendations.push('   - Ensure the Cognito user pool configuration is correct');
      }
      
      if (has403Errors) {
        recommendations.push('🚫 Authorization issue: User lacks required database permissions');
        recommendations.push('   - Run: scripts/setup-integration-test-user.sh');
        recommendations.push('   - Verify the user exists in organization_members table');
        recommendations.push('   - Ensure the user has contributor, leadership, or admin role');
        recommendations.push('   - Check that the user is in an active organization');
      }
      
      // Specific recommendations for each failed test
      failedTests.forEach(test => {
        if (test.recommendation) {
          recommendations.push(`   - ${test.endpoint} ${test.method}: ${test.recommendation}`);
        }
      });
      
      recommendations.push('');
      recommendations.push('🔧 To fix permission issues:');
      recommendations.push('   1. Set DB_PASSWORD environment variable');
      recommendations.push('   2. Run: ./scripts/setup-integration-test-user.sh');
      recommendations.push('   3. Verify user was added to organization_members table');
      recommendations.push('   4. Re-run the integration tests');
    } else {
      recommendations.push('✅ All permissions are working correctly!');
      recommendations.push('   The integration test user has proper access to create, read, update, and delete tools.');
    }

    return {
      hasAllPermissions,
      diagnostics,
      recommendations
    };
  }

  /**
   * Print diagnostic report to console
   */
  printDiagnosticReport(diagnostic: {
    hasAllPermissions: boolean;
    diagnostics: PermissionDiagnostic[];
    recommendations: string[];
  }): void {
    console.log('\n📋 PERMISSION DIAGNOSTIC REPORT');
    console.log('================================');
    
    diagnostic.diagnostics.forEach(d => {
      const status = d.result.hasPermission ? '✅' : '❌';
      console.log(`${status} ${d.method} ${d.endpoint}`);
      console.log(`   Expected: ${d.expectedPermission}`);
      console.log(`   Status: ${d.result.statusCode || 'N/A'}`);
      if (d.result.error) {
        console.log(`   Error: ${d.result.error}`);
      }
      console.log('');
    });
    
    console.log('📝 RECOMMENDATIONS:');
    diagnostic.recommendations.forEach(rec => {
      console.log(rec);
    });
    console.log('');
  }
}

// Export a singleton instance for use in tests
export const permissionValidator = new PermissionValidator();