/**
 * TestToolCreator - Handles tool creation for integration tests
 * 
 * This class provides functionality to create, validate, and cleanup test tools
 * through real Lambda API endpoints using the same apiService as the frontend.
 */

import { testAuthService } from './testAuth';
import { apiService, getApiData } from '@/lib/apiService';

export interface TestTool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  serial_number?: string;
  storage_location?: string;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateToolRequest {
  name: string;
  description?: string;
  category?: string;
  status?: string;
  serial_number?: string;
  storage_location?: string;
  parent_structure_id?: string;
  accountable_person_id?: string;
  image_url?: string;
}

export class TestToolCreator {
  private createdTools: TestTool[] = [];

  constructor() {
    // No need to store API base URL since apiService handles this
  }

  /**
   * Generate a unique test tool name with timestamp
   */
  generateUniqueToolName(baseName: string = 'Test Tool'): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseName} ${timestamp}-${randomSuffix}`;
  }

  /**
   * Create a test tool through the API
   */
  async createTestTool(toolData: Partial<CreateToolRequest> = {}): Promise<TestTool> {
    // Generate unique name if not provided
    const toolName = toolData.name || this.generateUniqueToolName();
    
    const requestBody: CreateToolRequest = {
      name: toolName,
      description: toolData.description || `Integration test tool created at ${new Date().toISOString()}`,
      category: toolData.category || 'Test Equipment',
      status: toolData.status || 'available',
      serial_number: toolData.serial_number || `TEST-${Date.now()}`,
      storage_location: toolData.storage_location || 'Test Storage Area',
      ...toolData
    };

    console.log('🔧 Creating test tool:', {
      name: requestBody.name,
      category: requestBody.category,
      status: requestBody.status
    });

    try {
      const response = await apiService.post('/tools', requestBody);
      const createdTool = getApiData(response) as TestTool;
      
      // Track created tool for cleanup
      this.createdTools.push(createdTool);
      
      console.log('✅ Test tool created successfully:', {
        id: createdTool.id,
        name: createdTool.name,
        status: createdTool.status
      });

      return createdTool;
    } catch (error: any) {
      console.error('❌ Tool creation failed:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error
      });
      throw new Error(`Tool creation failed: ${error.status} ${error.statusText} - ${error.message}`);
    }
  }

  /**
   * Validate that a tool exists and has expected properties
   */
  async validateToolExists(toolId: string): Promise<TestTool | null> {
    try {
      const response = await apiService.get('/tools');
      const tools = getApiData(response) as TestTool[];
      
      const tool = tools.find(t => t.id === toolId);
      
      if (tool) {
        console.log('✅ Tool validation successful:', {
          id: tool.id,
          name: tool.name,
          status: tool.status
        });
      } else {
        console.log('❌ Tool not found during validation:', toolId);
      }

      return tool || null;
    } catch (error: any) {
      console.error('❌ Tool validation error:', error);
      return null;
    }
  }

  /**
   * Verify tool state matches expected values
   */
  async validateToolState(toolId: string, expectedState: Partial<TestTool>): Promise<boolean> {
    const tool = await this.validateToolExists(toolId);
    
    if (!tool) {
      console.error('❌ Cannot validate state - tool not found:', toolId);
      return false;
    }

    const mismatches: string[] = [];
    
    // Check each expected property
    for (const [key, expectedValue] of Object.entries(expectedState)) {
      const actualValue = (tool as any)[key];
      if (actualValue !== expectedValue) {
        mismatches.push(`${key}: expected '${expectedValue}', got '${actualValue}'`);
      }
    }

    if (mismatches.length > 0) {
      console.error('❌ Tool state validation failed:', {
        toolId,
        mismatches
      });
      return false;
    }

    console.log('✅ Tool state validation passed:', {
      toolId,
      validatedProperties: Object.keys(expectedState)
    });
    
    return true;
  }

  /**
   * Compare tool data between different API responses
   */
  compareToolData(tool1: TestTool, tool2: TestTool): { matches: boolean; differences: string[] } {
    const differences: string[] = [];
    
    // Compare key properties
    const keysToCompare = ['id', 'name', 'description', 'category', 'status', 'serial_number'];
    
    for (const key of keysToCompare) {
      const value1 = (tool1 as any)[key];
      const value2 = (tool2 as any)[key];
      
      if (value1 !== value2) {
        differences.push(`${key}: '${value1}' vs '${value2}'`);
      }
    }

    const matches = differences.length === 0;
    
    if (matches) {
      console.log('✅ Tool data comparison passed');
    } else {
      console.log('❌ Tool data comparison failed:', differences);
    }

    return { matches, differences };
  }

  /**
   * Get all created tools for tracking
   */
  getCreatedTools(): TestTool[] {
    return [...this.createdTools];
  }

  /**
   * Clean up all created test tools
   */
  async cleanupCreatedTools(): Promise<void> {
    console.log(`🧹 Cleaning up ${this.createdTools.length} created test tools...`);
    
    const cleanupResults = [];
    
    for (const tool of this.createdTools) {
      try {
        await this.deleteTool(tool.id);
        cleanupResults.push({ toolId: tool.id, success: true });
        console.log(`✅ Cleaned up tool: ${tool.name} (${tool.id})`);
      } catch (error) {
        cleanupResults.push({ toolId: tool.id, success: false, error: error.message });
        console.error(`❌ Failed to cleanup tool: ${tool.name} (${tool.id})`, error);
      }
    }

    // Clear the tracking array
    this.createdTools = [];
    
    const successCount = cleanupResults.filter(r => r.success).length;
    const failureCount = cleanupResults.filter(r => !r.success).length;
    
    console.log(`🧹 Cleanup complete: ${successCount} success, ${failureCount} failures`);
    
    if (failureCount > 0) {
      const failures = cleanupResults.filter(r => !r.success);
      console.warn('⚠️ Some tools could not be cleaned up:', failures);
    }
  }

  /**
   * Delete a specific tool (used for cleanup)
   */
  private async deleteTool(toolId: string): Promise<void> {
    try {
      // Since there's no DELETE endpoint for tools, we'll mark it as 'removed'
      await apiService.put(`/tools/${toolId}`, {
        status: 'removed'
      });
    } catch (error: any) {
      throw new Error(`Failed to delete tool ${toolId}: ${error.status} - ${error.message}`);
    }
  }

  /**
   * Create a tool with minimal required data for testing
   */
  async createMinimalTool(): Promise<TestTool> {
    return this.createTestTool({
      name: this.generateUniqueToolName('Minimal Test Tool')
    });
  }

  /**
   * Create a tool with complete data for comprehensive testing
   */
  async createCompleteTool(): Promise<TestTool> {
    return this.createTestTool({
      name: this.generateUniqueToolName('Complete Test Tool'),
      description: 'A comprehensive test tool with all fields populated for integration testing',
      category: 'Test Equipment',
      status: 'available',
      serial_number: `COMPLETE-${Date.now()}`,
      storage_location: 'Integration Test Storage Area'
    });
  }
}

// Export a singleton instance for use in tests
export const testToolCreator = new TestToolCreator();