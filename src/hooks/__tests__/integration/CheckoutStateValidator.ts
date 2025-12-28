/**
 * CheckoutStateValidator - Validates tool checkout state consistency
 * 
 * This class tests the specific bug fix for tool status computation
 * across different API endpoints (tools vs actions).
 */

import { testAuthService } from './testAuth';
import { TestTool } from './TestToolCreator';

export interface ToolWithCheckoutInfo extends TestTool {
  is_checked_out?: boolean;
  checked_out_user_id?: string;
  checked_out_to?: string;
  checked_out_date?: string;
  expected_return_date?: string;
  checkout_intended_usage?: string;
  checkout_notes?: string;
  checkout_action_id?: string;
}

export interface ActionWithTools {
  id: string;
  title: string;
  description?: string;
  status: string;
  assigned_to?: string;
  tools?: ToolWithCheckoutInfo[];
  created_at?: string;
  updated_at?: string;
}

export interface CheckoutStateValidationResult {
  isValid: boolean;
  toolsEndpointStatus: string;
  actionsEndpointStatus: string;
  isCheckedOut: boolean;
  differences: string[];
  details: any;
}

export class CheckoutStateValidator {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.VITE_API_BASE_URL || 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
  }

  /**
   * Validate that a newly created tool starts in the correct initial state
   */
  async validateInitialToolState(toolId: string): Promise<{
    isValid: boolean;
    tool: ToolWithCheckoutInfo | null;
    issues: string[];
  }> {
    console.log('🔍 Validating initial tool state for:', toolId);
    
    const issues: string[] = [];
    
    try {
      const tool = await this.getToolFromToolsEndpoint(toolId);
      
      if (!tool) {
        issues.push('Tool not found in tools endpoint');
        return { isValid: false, tool: null, issues };
      }

      // Validate initial state expectations
      if (tool.status !== 'available') {
        issues.push(`Expected status 'available', got '${tool.status}'`);
      }

      if (tool.is_checked_out === true) {
        issues.push(`Expected is_checked_out to be false, got ${tool.is_checked_out}`);
      }

      if (tool.checked_out_user_id) {
        issues.push(`Expected no checked_out_user_id, got '${tool.checked_out_user_id}'`);
      }

      if (tool.checkout_action_id) {
        issues.push(`Expected no checkout_action_id, got '${tool.checkout_action_id}'`);
      }

      const isValid = issues.length === 0;
      
      if (isValid) {
        console.log('✅ Initial tool state validation passed');
      } else {
        console.log('❌ Initial tool state validation failed:', issues);
      }

      return { isValid, tool, issues };
    } catch (error) {
      console.error('❌ Error validating initial tool state:', error);
      issues.push(`Validation error: ${error.message}`);
      return { isValid: false, tool: null, issues };
    }
  }

  /**
   * Validate checkout state consistency between tools and actions endpoints
   */
  async validateCheckoutStateConsistency(
    toolId: string, 
    actionId?: string
  ): Promise<CheckoutStateValidationResult> {
    console.log('🔍 Validating checkout state consistency for tool:', toolId);
    
    try {
      // Get tool data from both endpoints
      const toolFromToolsEndpoint = await this.getToolFromToolsEndpoint(toolId);
      const toolFromActionsEndpoint = actionId 
        ? await this.getToolFromActionsEndpoint(actionId, toolId)
        : null;

      if (!toolFromToolsEndpoint) {
        return {
          isValid: false,
          toolsEndpointStatus: 'NOT_FOUND',
          actionsEndpointStatus: 'N/A',
          isCheckedOut: false,
          differences: ['Tool not found in tools endpoint'],
          details: { toolId }
        };
      }

      const differences: string[] = [];
      
      // If we have both endpoints, compare them
      if (toolFromActionsEndpoint) {
        const comparison = this.compareToolStates(toolFromToolsEndpoint, toolFromActionsEndpoint);
        differences.push(...comparison.differences);
      }

      // Validate the specific bug fix: status should be 'checked_out' when is_checked_out is true
      const statusConsistencyCheck = this.validateStatusConsistency(toolFromToolsEndpoint);
      if (!statusConsistencyCheck.isConsistent) {
        differences.push(...statusConsistencyCheck.issues);
      }

      const isValid = differences.length === 0;
      
      const result: CheckoutStateValidationResult = {
        isValid,
        toolsEndpointStatus: toolFromToolsEndpoint.status || 'unknown',
        actionsEndpointStatus: toolFromActionsEndpoint?.status || 'N/A',
        isCheckedOut: toolFromToolsEndpoint.is_checked_out || false,
        differences,
        details: {
          toolId,
          actionId,
          toolsEndpointData: toolFromToolsEndpoint,
          actionsEndpointData: toolFromActionsEndpoint,
          statusConsistency: statusConsistencyCheck
        }
      };

      if (isValid) {
        console.log('✅ Checkout state consistency validation passed');
      } else {
        console.log('❌ Checkout state consistency validation failed:', differences);
      }

      return result;
    } catch (error) {
      console.error('❌ Error validating checkout state consistency:', error);
      return {
        isValid: false,
        toolsEndpointStatus: 'ERROR',
        actionsEndpointStatus: 'ERROR',
        isCheckedOut: false,
        differences: [`Validation error: ${error.message}`],
        details: { error: error.message }
      };
    }
  }

  /**
   * Compare tool responses from different endpoints
   */
  async compareEndpointResponses(
    toolId: string,
    actionId: string
  ): Promise<{
    toolsEndpointTool: ToolWithCheckoutInfo | null;
    actionsEndpointTool: ToolWithCheckoutInfo | null;
    comparison: {
      matches: boolean;
      differences: string[];
      statusConsistent: boolean;
    };
  }> {
    console.log('🔍 Comparing endpoint responses for tool:', toolId);
    
    const toolsEndpointTool = await this.getToolFromToolsEndpoint(toolId);
    const actionsEndpointTool = await this.getToolFromActionsEndpoint(actionId, toolId);
    
    const comparison = {
      matches: false,
      differences: [] as string[],
      statusConsistent: false
    };

    if (!toolsEndpointTool) {
      comparison.differences.push('Tool not found in tools endpoint');
    }

    if (!actionsEndpointTool) {
      comparison.differences.push('Tool not found in actions endpoint');
    }

    if (toolsEndpointTool && actionsEndpointTool) {
      const stateComparison = this.compareToolStates(toolsEndpointTool, actionsEndpointTool);
      comparison.differences.push(...stateComparison.differences);
      comparison.matches = stateComparison.matches;
      
      // Check status consistency for both
      const toolsStatusCheck = this.validateStatusConsistency(toolsEndpointTool);
      const actionsStatusCheck = this.validateStatusConsistency(actionsEndpointTool);
      
      comparison.statusConsistent = toolsStatusCheck.isConsistent && actionsStatusCheck.isConsistent;
      
      if (!comparison.statusConsistent) {
        comparison.differences.push(...toolsStatusCheck.issues);
        comparison.differences.push(...actionsStatusCheck.issues);
      }
    }

    return {
      toolsEndpointTool,
      actionsEndpointTool,
      comparison
    };
  }

  /**
   * Get tool data from the tools endpoint
   */
  private async getToolFromToolsEndpoint(toolId: string): Promise<ToolWithCheckoutInfo | null> {
    try {
      const idToken = await testAuthService.getIdToken();
      
      const response = await fetch(`${this.apiBaseUrl}/tools`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch from tools endpoint:', response.status);
        return null;
      }

      const result = await response.json();
      const tools = result.data as ToolWithCheckoutInfo[];
      
      return tools.find(t => t.id === toolId) || null;
    } catch (error) {
      console.error('❌ Error fetching from tools endpoint:', error);
      return null;
    }
  }

  /**
   * Get tool data from the actions endpoint
   */
  private async getToolFromActionsEndpoint(actionId: string, toolId: string): Promise<ToolWithCheckoutInfo | null> {
    try {
      const idToken = await testAuthService.getIdToken();
      
      const response = await fetch(`${this.apiBaseUrl}/actions/${actionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch from actions endpoint:', response.status);
        return null;
      }

      const result = await response.json();
      const action = result.data as ActionWithTools;
      
      // Find the specific tool in the action's tools array
      return action.tools?.find(t => t.id === toolId) || null;
    } catch (error) {
      console.error('❌ Error fetching from actions endpoint:', error);
      return null;
    }
  }

  /**
   * Compare tool states between two tool objects
   */
  private compareToolStates(
    tool1: ToolWithCheckoutInfo, 
    tool2: ToolWithCheckoutInfo
  ): { matches: boolean; differences: string[] } {
    const differences: string[] = [];
    
    // Compare key checkout-related properties
    const keysToCompare = [
      'status',
      'is_checked_out',
      'checked_out_user_id',
      'checkout_action_id'
    ];
    
    for (const key of keysToCompare) {
      const value1 = (tool1 as any)[key];
      const value2 = (tool2 as any)[key];
      
      if (value1 !== value2) {
        differences.push(`${key}: tools endpoint='${value1}' vs actions endpoint='${value2}'`);
      }
    }

    return {
      matches: differences.length === 0,
      differences
    };
  }

  /**
   * Validate that status is consistent with is_checked_out flag
   * This is the specific bug fix we're testing
   */
  private validateStatusConsistency(tool: ToolWithCheckoutInfo): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // The bug fix: when is_checked_out is true, status should be 'checked_out'
    if (tool.is_checked_out === true && tool.status !== 'checked_out') {
      issues.push(`Status inconsistency: is_checked_out=true but status='${tool.status}' (should be 'checked_out')`);
    }
    
    // When is_checked_out is false, status should NOT be 'checked_out'
    if (tool.is_checked_out === false && tool.status === 'checked_out') {
      issues.push(`Status inconsistency: is_checked_out=false but status='checked_out'`);
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  /**
   * Create a test action with a tool to test checkout state
   */
  async createTestActionWithTool(toolId: string): Promise<string | null> {
    try {
      const idToken = await testAuthService.getIdToken();
      
      const actionData = {
        title: `Test Action for Tool ${toolId}`,
        description: 'Integration test action to validate checkout state consistency',
        status: 'in_progress',
        tools: [toolId] // Add the tool to the action
      };

      console.log('🔧 Creating test action with tool:', toolId);

      const response = await fetch(`${this.apiBaseUrl}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(actionData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to create test action:', response.status, errorText);
        return null;
      }

      const result = await response.json();
      const actionId = result.data?.id;
      
      console.log('✅ Created test action:', actionId);
      return actionId;
    } catch (error) {
      console.error('❌ Error creating test action:', error);
      return null;
    }
  }

  /**
   * Clean up a test action
   */
  async cleanupTestAction(actionId: string): Promise<void> {
    try {
      const idToken = await testAuthService.getIdToken();
      
      // Mark action as completed to release any checked out tools
      await fetch(`${this.apiBaseUrl}/actions/${actionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          status: 'completed'
        })
      });

      console.log('🧹 Cleaned up test action:', actionId);
    } catch (error) {
      console.error('❌ Failed to cleanup test action:', actionId, error);
    }
  }
}

// Export a singleton instance for use in tests
export const checkoutStateValidator = new CheckoutStateValidator();