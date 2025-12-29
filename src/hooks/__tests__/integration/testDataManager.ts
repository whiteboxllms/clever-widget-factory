/**
 * Test Data Manager for Integration Tests
 * 
 * Manages creation, isolation, and cleanup of test data with authentication
 */

import { apiService } from '@/lib/apiService';
import { TestActionData, TestToolData, IntegrationTestConfig, defaultIntegrationConfig } from './config';
import { setupTestAuth, cleanupTestAuth, createAuthenticatedApiService } from './testAuth';

export class TestDataManager {
  private config: IntegrationTestConfig;
  private createdActions: Set<string> = new Set();
  private createdTools: Set<string> = new Set();
  private testRunId: string;
  private authServiceRestore?: () => void;

  constructor(config: IntegrationTestConfig = defaultIntegrationConfig) {
    this.config = config;
    this.testRunId = `${config.testDataPrefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique test ID for this test run
   */
  generateTestId(prefix: string = 'test'): string {
    return `${this.testRunId}-${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a test action through the real API
   */
  async createTestAction(overrides: Partial<TestActionData> = {}): Promise<TestActionData> {
    const testId = this.generateTestId('action');
    
    const actionData: Partial<TestActionData> = {
      title: `Integration Test Action ${testId}`,
      description: `Test action created for integration testing - ${testId}`,
      status: 'pending',
      priority: 'medium',
      required_tools: [],
      ...overrides
    };

    try {
      const response = await apiService.post<{ data: TestActionData }>('/actions', actionData);
      const createdAction = response.data;
      
      this.createdActions.add(createdAction.id);
      console.log(`Created test action: ${createdAction.id}`);
      
      return createdAction;
    } catch (error) {
      console.error('Failed to create test action:', error);
      throw new Error(`Failed to create test action: ${error}`);
    }
  }

  /**
   * Create multiple test tools through the real API
   */
  async createTestTools(count: number = 2): Promise<TestToolData[]> {
    const tools: TestToolData[] = [];
    
    for (let i = 0; i < count; i++) {
      const testId = this.generateTestId(`tool-${i}`);
      
      const toolData = {
        name: `Integration Test Tool ${testId}`,
        status: 'available' as const,
        description: `Test tool created for integration testing - ${testId}`,
        location: 'Test Location',
        category: 'Test Category'
      };

      try {
        const response = await apiService.post<{ data: TestToolData }>('/tools', toolData);
        const createdTool = response.data;
        
        this.createdTools.add(createdTool.id);
        tools.push(createdTool);
        console.log(`Created test tool: ${createdTool.id}`);
      } catch (error) {
        console.error(`Failed to create test tool ${i}:`, error);
        throw new Error(`Failed to create test tool ${i}: ${error}`);
      }
    }
    
    return tools;
  }

  /**
   * Create a single test tool through the real API
   */
  async createTestTool(overrides: Partial<TestToolData> = {}): Promise<TestToolData> {
    const testId = this.generateTestId('tool');
    
    const toolData = {
      name: `Integration Test Tool ${testId}`,
      status: 'available' as const,
      description: `Test tool created for integration testing - ${testId}`,
      location: 'Test Location',
      category: 'Test Category',
      ...overrides
    };

    try {
      const response = await apiService.post<{ data: TestToolData }>('/tools', toolData);
      const createdTool = response.data;
      
      this.createdTools.add(createdTool.id);
      console.log(`Created test tool: ${createdTool.id} (${createdTool.name})`);
      
      return createdTool;
    } catch (error) {
      console.error('Failed to create test tool:', error);
      throw new Error(`Failed to create test tool: ${error}`);
    }
  }

  /**
   * Update an action through the real API
   */
  async updateTestAction(actionId: string, updates: Partial<TestActionData>): Promise<TestActionData> {
    try {
      const response = await apiService.put<{ data: TestActionData; affectedResources?: any }>(`/actions/${actionId}`, updates);
      console.log(`Updated test action: ${actionId}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Failed to update test action ${actionId}:`, error);
      throw new Error(`Failed to update test action ${actionId}: ${error}`);
    }
  }

  /**
   * Get an action by ID through the real API
   */
  async getTestAction(actionId: string): Promise<TestActionData | null> {
    try {
      const response = await apiService.get<TestActionData[]>(`/actions?id=${actionId}`);
      return response.length > 0 ? response[0] : null;
    } catch (error) {
      console.error(`Failed to get test action ${actionId}:`, error);
      return null;
    }
  }

  /**
   * Get tools by IDs through the real API
   */
  async getTestTools(toolIds: string[]): Promise<TestToolData[]> {
    try {
      const response = await apiService.get<{ data: TestToolData[] }>('/tools');
      return response.data.filter(tool => toolIds.includes(tool.id));
    } catch (error) {
      console.error('Failed to get test tools:', error);
      return [];
    }
  }

  /**
   * Get a single tool by ID through the real API
   */
  async getTestTool(toolId: string): Promise<TestToolData | null> {
    try {
      const response = await apiService.get<{ data: TestToolData[] }>('/tools');
      const tool = response.data.find(t => t.id === toolId);
      return tool || null;
    } catch (error) {
      console.error(`Failed to get test tool ${toolId}:`, error);
      return null;
    }
  }

  /**
   * Clean up a specific test action
   */
  async cleanupTestAction(actionId: string): Promise<void> {
    try {
      await apiService.delete(`/actions/${actionId}`);
      this.createdActions.delete(actionId);
      console.log(`Cleaned up test action: ${actionId}`);
    } catch (error) {
      console.warn(`Failed to cleanup test action ${actionId}:`, error);
    }
  }

  /**
   * Clean up a specific test tool
   */
  async cleanupTestTool(toolId: string): Promise<void> {
    try {
      await apiService.delete(`/tools/${toolId}`);
      this.createdTools.delete(toolId);
      console.log(`Cleaned up test tool: ${toolId}`);
    } catch (error) {
      console.warn(`Failed to cleanup test tool ${toolId}:`, error);
    }
  }

  /**
   * Clean up multiple test tools
   */
  async cleanupTestTools(toolIds: string[]): Promise<void> {
    for (const toolId of toolIds) {
      await this.cleanupTestTool(toolId);
    }
  }

  /**
   * Clean up all test data created during this test run
   */
  async cleanupTestData(): Promise<void> {
    if (this.config.cleanupStrategy === 'manual') {
      console.log('Manual cleanup - skipping automatic cleanup');
      return;
    }

    console.log(`Cleaning up test data for run: ${this.testRunId}`);
    
    // Clean up actions
    for (const actionId of this.createdActions) {
      try {
        await apiService.delete(`/actions/${actionId}`);
        console.log(`Cleaned up test action: ${actionId}`);
      } catch (error) {
        console.warn(`Failed to cleanup test action ${actionId}:`, error);
      }
    }

    // Clean up tools
    for (const toolId of this.createdTools) {
      try {
        await apiService.delete(`/tools/${toolId}`);
        console.log(`Cleaned up test tool: ${toolId}`);
      } catch (error) {
        console.warn(`Failed to cleanup test tool ${toolId}:`, error);
      }
    }

    this.createdActions.clear();
    this.createdTools.clear();
  }

  /**
   * Setup test environment with authentication
   */
  async setupTestEnvironment(): Promise<void> {
    console.log(`Setting up integration test environment for run: ${this.testRunId}`);
    
    // Setup test authentication
    try {
      await setupTestAuth();
      console.log('✅ Test authentication configured');
      
      // Override the API service to use test authentication
      this.authServiceRestore = createAuthenticatedApiService().restore;
    } catch (error) {
      console.error('❌ Failed to setup test authentication:', error);
      throw new Error(`Failed to setup test authentication: ${error}`);
    }
    
    // Verify API connectivity
    try {
      await apiService.get('/health');
      console.log('✅ API connectivity verified');
    } catch (error) {
      console.error('❌ Failed to connect to API:', error);
      throw new Error(`Failed to connect to API: ${error}`);
    }
  }

  /**
   * Teardown test environment
   */
  async teardownTestEnvironment(): Promise<void> {
    console.log(`Tearing down integration test environment for run: ${this.testRunId}`);
    
    // Cleanup test data first
    await this.cleanupTestData();
    
    // Restore original API service
    if (this.authServiceRestore) {
      this.authServiceRestore();
    }
    
    // Cleanup test authentication
    try {
      await cleanupTestAuth();
      console.log('✅ Test authentication cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup test authentication:', error);
    }
  }

  /**
   * Get test run statistics
   */
  getTestRunStats() {
    return {
      testRunId: this.testRunId,
      createdActions: this.createdActions.size,
      createdTools: this.createdTools.size,
      config: this.config
    };
  }
}