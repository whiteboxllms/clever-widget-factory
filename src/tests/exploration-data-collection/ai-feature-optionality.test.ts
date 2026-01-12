/**
 * Property-Based Tests for AI Feature Optionality
 * 
 * Tests universal properties for AI feature optionality and graceful degradation
 * 
 * Feature: exploration-data-collection-flow, Property 26: AI Feature Optionality
 * Validates: Requirements 8.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIContentService, SummaryPolicyRequest, ExplorationSuggestionRequest, PolicyDraftRequest } from '../../services/aiContentService';
import { apiService } from '../../lib/apiService';

// Mock the API service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

describe('AI Feature Optionality Property Tests', () => {
  let aiContentService: AIContentService;

  beforeEach(() => {
    vi.clearAllMocks();
    aiContentService = new AIContentService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 26: AI Feature Optionality
   * For any system state (AI available or unavailable), the application should
   * continue to function with appropriate fallbacks and user feedback
   * Validates: Requirements 8.6
   */
  describe('Property 26: AI Feature Optionality', () => {
    it('should function normally when AI service is available', async () => {
      // Property: When AI is available, all features should work with high confidence
      
      // Mock successful AI service
      (apiService.get as any).mockResolvedValue({ status: 200 });
      (apiService.post as any).mockResolvedValue({
        data: {
          content: JSON.stringify({
            summary_policy_text: 'AI-generated summary with safety protocols and documentation requirements.',
            key_points: ['Safety protocols', 'Documentation', 'Quality control'],
            safety_considerations: ['PPE required', 'Follow procedures']
          }),
          confidence: 0.85,
          model: 'gpt-4'
        }
      });

      // Test AI availability check
      const isAvailable = await aiContentService.isAvailable();
      expect(isAvailable).toBe(true);

      // Test AI content generation
      const request: SummaryPolicyRequest = {
        state_text: 'Testing new safety procedures for equipment maintenance',
        policy_text: 'Follow established safety protocols and document all activities'
      };

      const result = await aiContentService.generateSummaryPolicy(request);

      // Property: AI-generated content should have high confidence
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      if (result) {
        expect(result.content.summary_policy_text).toBeTruthy();
        expect(result.confidence).toBeGreaterThan(0.7); // High confidence when AI is available
        expect(result.model_used).toBe('gpt-4');
        expect(result.model_used).not.toBe('fallback');
      }
    });

    it('should provide fallback functionality when AI service is unavailable', async () => {
      // Property: When AI is unavailable, fallbacks should provide basic functionality
      
      // Mock AI service unavailability
      (apiService.get as any).mockRejectedValue(new Error('Service unavailable'));
      (apiService.post as any).mockRejectedValue(new Error('Service unavailable'));

      // Test AI availability check
      const isAvailable = await aiContentService.isAvailable();
      expect(isAvailable).toBe(false);

      // Test fallback content generation
      const request: SummaryPolicyRequest = {
        state_text: 'Testing equipment maintenance procedures',
        policy_text: 'Follow safety protocols during maintenance'
      };

      const result = await aiContentService.generateSummaryPolicy(request);

      // Property: Fallback should still provide usable content
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      if (result) {
        expect(result.content.summary_policy_text).toBeTruthy();
        expect(result.content.summary_policy_text.length).toBeGreaterThan(0);
        
        // Property: Fallback should have lower confidence
        expect(result.confidence).toBeLessThan(0.7);
        expect(result.model_used).toBe('fallback');
        
        // Property: Fallback should include basic safety elements
        const fallbackText = result.content.summary_policy_text.toLowerCase();
        const hasSafetyContent = fallbackText.includes('safety') || 
                                fallbackText.includes('protocol') ||
                                fallbackText.includes('document');
        expect(hasSafetyContent).toBe(true);
      }
    });

    it('should handle partial AI service failures gracefully', async () => {
      // Property: Partial failures should not break the entire system
      
      // Mock mixed success/failure scenarios
      let callCount = 0;
      (apiService.get as any).mockResolvedValue({ status: 200 });
      (apiService.post as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds
          return Promise.resolve({
            data: {
              content: JSON.stringify({
                summary_policy_text: 'AI-generated content',
                key_points: ['Point 1', 'Point 2'],
                safety_considerations: ['Safety 1']
              }),
              confidence: 0.8,
              model: 'gpt-4'
            }
          });
        } else {
          // Subsequent calls fail
          return Promise.reject(new Error('Rate limit exceeded'));
        }
      });

      const request: SummaryPolicyRequest = {
        state_text: 'Testing system resilience',
        policy_text: 'Handle failures gracefully'
      };

      // First call should succeed
      const result1 = await aiContentService.generateSummaryPolicy(request);
      expect(result1).toBeDefined();
      expect(result1).not.toBeNull();
      if (result1) {
        expect(result1.model_used).toBe('gpt-4');
        expect(result1.confidence).toBeGreaterThan(0.7);
      }

      // Second call should fall back
      const result2 = await aiContentService.generateSummaryPolicy(request);
      expect(result2).toBeDefined();
      expect(result2).not.toBeNull();
      if (result2) {
        expect(result2.model_used).toBe('fallback');
        expect(result2.confidence).toBeLessThan(0.7);
      }
    });

    it('should handle different types of AI service errors appropriately', async () => {
      // Property: Different error types should be handled with appropriate fallbacks
      
      const errorScenarios = [
        { error: new Error('Network timeout'), description: 'network timeout' },
        { error: { response: { status: 429 } }, description: 'rate limiting' },
        { error: { response: { status: 503 } }, description: 'service unavailable' },
        { error: new Error('Invalid API key'), description: 'authentication error' }
      ];

      const request: SummaryPolicyRequest = {
        state_text: 'Testing error handling',
        policy_text: 'System should handle all error types'
      };

      for (const scenario of errorScenarios) {
        // Mock the specific error
        (apiService.post as any).mockRejectedValueOnce(scenario.error);

        const result = await aiContentService.generateSummaryPolicy(request);

        // Property: All error types should result in fallback responses
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        
        if (result) {
          expect(result.content.summary_policy_text).toBeTruthy();
          expect(result.model_used).toBe('fallback');
          expect(result.confidence).toBeLessThan(0.7);
          
          // Property: Fallback should reference the input context
          const fallbackText = result.content.summary_policy_text.toLowerCase();
          const inputText = request.state_text.toLowerCase();
          const hasContextReference = inputText.split(' ').some(word => 
            word.length > 3 && fallbackText.includes(word)
          ) || fallbackText.includes('error') || fallbackText.includes('handle');
          expect(hasContextReference).toBe(true);
        }
      }
    });

    it('should maintain consistent behavior across different AI feature types', async () => {
      // Property: All AI features should have consistent optionality behavior
      
      // Mock AI service failure for all endpoints
      (apiService.post as any).mockRejectedValue(new Error('Service unavailable'));

      const summaryRequest: SummaryPolicyRequest = {
        state_text: 'Testing consistency across features',
        policy_text: 'All features should behave consistently'
      };

      const explorationRequest: ExplorationSuggestionRequest = {
        action_id: 'action-1',
        state_text: 'Testing exploration suggestions',
        policy_text: 'Generate consistent suggestions'
      };

      const policyRequest: PolicyDraftRequest = {
        exploration_data: {
          exploration_code: 'SF010426EX01',
          exploration_notes_text: 'Test exploration notes',
          metrics_text: 'Test metrics',
          action_title: 'Test Action',
          state_text: 'Test state'
        }
      };

      // Test all AI features
      const summaryResult = await aiContentService.generateSummaryPolicy(summaryRequest);
      const explorationResult = await aiContentService.generateExplorationSuggestions(explorationRequest);
      const policyResult = await aiContentService.generatePolicyDraft(policyRequest);

      // Property: All features should provide fallback responses
      const results = [summaryResult, explorationResult, policyResult];
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        
        if (result) {
          expect(result.model_used).toBe('fallback');
          expect(result.confidence).toBeLessThan(0.7);
          expect(result.generated_at).toBeTruthy();
          expect(result.context_used).toContain('fallback_generation');
        }
      });

      // Property: All fallback responses should have similar confidence ranges
      const confidences = results.filter(r => r !== null).map(r => r!.confidence);
      const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
      const maxDeviation = Math.max(...confidences.map(conf => Math.abs(conf - avgConfidence)));
      
      expect(maxDeviation).toBeLessThan(0.3); // Fallback confidences should be similar
    });

    it('should provide appropriate user feedback for AI service status', async () => {
      // Property: Users should receive clear feedback about AI service availability
      
      // Test when AI is available
      (apiService.get as any).mockResolvedValue({ status: 200 });
      
      const isAvailable = await aiContentService.isAvailable();
      expect(isAvailable).toBe(true);

      // Test when AI is unavailable
      (apiService.get as any).mockRejectedValue(new Error('Service down'));
      
      const isUnavailable = await aiContentService.isAvailable();
      expect(isUnavailable).toBe(false);

      // Property: Availability check should be reliable and fast
      const startTime = Date.now();
      await aiContentService.isAvailable();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle malformed AI responses gracefully', async () => {
      // Property: Malformed AI responses should not break the system
      
      const malformedResponses = [
        { data: null }, // Null response
        { data: { content: null } }, // Null content
        { data: { content: 'invalid json' } }, // Invalid JSON
        { data: { content: '{"incomplete": true' } }, // Incomplete JSON
        { data: { content: '{}' } }, // Empty JSON object
        { data: { content: JSON.stringify({ wrong_field: 'value' }) } } // Wrong structure
      ];

      const request: SummaryPolicyRequest = {
        state_text: 'Testing malformed response handling',
        policy_text: 'System should handle bad responses'
      };

      for (const response of malformedResponses) {
        (apiService.post as any).mockResolvedValueOnce(response);

        const result = await aiContentService.generateSummaryPolicy(request);

        // Property: Malformed responses should trigger fallback behavior
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        
        if (result) {
          expect(result.content.summary_policy_text).toBeTruthy();
          expect(result.model_used).toBe('fallback');
          expect(result.confidence).toBeLessThan(0.7);
        }
      }
    });

    it('should maintain data integrity when AI features are disabled', async () => {
      // Property: Core functionality should work without AI features
      
      // Mock AI service as completely unavailable
      (apiService.get as any).mockRejectedValue(new Error('AI disabled'));
      (apiService.post as any).mockRejectedValue(new Error('AI disabled'));

      // Test that fallback responses maintain data structure integrity
      const request: SummaryPolicyRequest = {
        state_text: 'Testing data integrity without AI',
        policy_text: 'Core functionality should remain intact'
      };

      const result = await aiContentService.generateSummaryPolicy(request);

      // Property: Fallback should maintain expected data structure
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      if (result) {
        // Check all required fields are present
        expect(result.content).toBeDefined();
        expect(result.content.summary_policy_text).toBeTruthy();
        expect(result.content.key_points).toBeInstanceOf(Array);
        expect(result.content.safety_considerations).toBeInstanceOf(Array);
        
        expect(result.confidence).toBeDefined();
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        expect(result.model_used).toBeDefined();
        expect(typeof result.model_used).toBe('string');
        
        expect(result.generated_at).toBeDefined();
        expect(typeof result.generated_at).toBe('string');
        
        expect(result.context_used).toBeDefined();
        expect(result.context_used).toBeInstanceOf(Array);
      }
    });

    it('should handle concurrent requests with mixed AI availability', async () => {
      // Property: Concurrent requests should be handled independently
      
      let requestCount = 0;
      (apiService.post as any).mockImplementation(() => {
        requestCount++;
        if (requestCount % 2 === 0) {
          // Even requests fail
          return Promise.reject(new Error('Service temporarily unavailable'));
        } else {
          // Odd requests succeed
          return Promise.resolve({
            data: {
              content: JSON.stringify({
                summary_policy_text: 'AI-generated content',
                key_points: ['Point 1'],
                safety_considerations: ['Safety 1']
              }),
              confidence: 0.8,
              model: 'gpt-4'
            }
          });
        }
      });

      const request: SummaryPolicyRequest = {
        state_text: 'Testing concurrent request handling',
        policy_text: 'Each request should be handled independently'
      };

      // Make multiple concurrent requests
      const promises = Array.from({ length: 6 }, () => 
        aiContentService.generateSummaryPolicy(request)
      );

      const results = await Promise.all(promises);

      // Property: All requests should complete successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        if (result) {
          expect(result.content.summary_policy_text).toBeTruthy();
        }
      });

      // Property: Should have mix of AI and fallback responses
      const aiResponses = results.filter(r => r && r.model_used === 'gpt-4').length;
      const fallbackResponses = results.filter(r => r && r.model_used === 'fallback').length;
      
      expect(aiResponses).toBeGreaterThan(0);
      expect(fallbackResponses).toBeGreaterThan(0);
      expect(aiResponses + fallbackResponses).toBe(results.length);
    });
  });
});