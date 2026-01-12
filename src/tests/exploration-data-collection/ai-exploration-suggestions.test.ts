/**
 * Property Test: AI Exploration Suggestions
 * 
 * Property 23: AI Exploration Suggestions
 * Validates: Requirements 8.2
 * 
 * Tests that AI exploration suggestions are generated appropriately
 * based on action context and provide relevant content for field work.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiContentService } from '../../services/aiContentService';
import { apiService } from '../../lib/apiService';

// Mock the API service
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

describe('Property Test: AI Exploration Suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate relevant exploration suggestions for various action contexts', async () => {
    // Property: For any valid action context, AI should generate relevant exploration suggestions
    const testCases = [
      {
        action_id: 'action-001',
        state_text: 'Invasive species removal in wetland area',
        policy_text: 'Follow environmental protection protocols',
        summary_policy_text: 'Remove invasive species safely with documentation'
      },
      {
        action_id: 'action-002', 
        state_text: 'Trail maintenance and erosion control',
        policy_text: 'Use sustainable materials and methods',
        existing_exploration_notes: 'Previous work showed good results with native plantings'
      },
      {
        action_id: 'action-003',
        state_text: 'Wildlife habitat restoration',
        existing_metrics: 'Species count: 15, Area covered: 2.5 acres'
      }
    ];

    // Mock successful AI responses
    const mockAIResponse = {
      data: {
        content: JSON.stringify({
          exploration_notes_text: 'Document species types, removal methods, and area coverage',
          metrics_text: 'Track removal volume, time spent, and regrowth monitoring',
          suggested_measurements: ['Area treated', 'Species removed', 'Time to completion'],
          comparison_areas: ['Untreated control area', 'Previously treated sections'],
          documentation_tips: ['Photo before/after', 'GPS coordinates', 'Weather conditions']
        }),
        confidence: 0.8,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockAIResponse);

    for (const testCase of testCases) {
      const result = await aiContentService.generateExplorationSuggestions(testCase);

      // Property: AI should always return structured suggestions
      expect(result).toBeTruthy();
      expect(result?.content).toBeDefined();
      
      // Property: Suggestions should contain all required fields
      const content = result!.content;
      expect(content.exploration_notes_text).toBeTruthy();
      expect(content.metrics_text).toBeTruthy();
      expect(Array.isArray(content.suggested_measurements)).toBe(true);
      expect(Array.isArray(content.comparison_areas)).toBe(true);
      expect(Array.isArray(content.documentation_tips)).toBe(true);

      // Property: Content should be contextually relevant (non-empty and reasonable length)
      expect(content.exploration_notes_text.length).toBeGreaterThan(10);
      expect(content.metrics_text.length).toBeGreaterThan(10);
      expect(content.suggested_measurements.length).toBeGreaterThan(0);
      expect(content.documentation_tips.length).toBeGreaterThan(0);

      // Property: Response should include metadata
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.model_used).toBeTruthy();
      expect(result!.generated_at).toBeTruthy();
      expect(Array.isArray(result!.context_used)).toBe(true);
    }
  });

  it('should handle AI service unavailability with fallback suggestions', async () => {
    // Property: When AI fails, fallback should provide basic but useful suggestions
    const testRequest = {
      action_id: 'action-fallback',
      state_text: 'Emergency tree removal after storm damage',
      policy_text: 'Safety first protocols for hazardous conditions'
    };

    // Mock AI service failure
    (apiService.post as any).mockRejectedValue(new Error('AI service unavailable'));

    const result = await aiContentService.generateExplorationSuggestions(testRequest);

    // Property: Fallback should still provide structured response
    expect(result).toBeTruthy();
    expect(result?.content).toBeDefined();
    
    const content = result!.content;
    expect(content.exploration_notes_text).toBeTruthy();
    expect(content.metrics_text).toBeTruthy();
    expect(Array.isArray(content.suggested_measurements)).toBe(true);
    expect(Array.isArray(content.comparison_areas)).toBe(true);
    expect(Array.isArray(content.documentation_tips)).toBe(true);

    // Property: Fallback should be marked as such
    expect(result!.model_used).toBe('fallback');
    expect(result!.confidence).toBeLessThan(0.6); // Lower confidence for fallback
    expect(result!.context_used).toContain('fallback_generation');
  });

  it('should generate context-aware suggestions based on existing exploration data', async () => {
    // Property: Suggestions should build upon existing exploration data when provided
    const requestWithExistingData = {
      action_id: 'action-existing',
      state_text: 'Continued habitat restoration work',
      existing_exploration_notes: 'Initial planting completed, monitoring growth rates',
      existing_metrics: 'Survival rate: 85%, Growth rate: 2cm/month'
    };

    const mockContextualResponse = {
      data: {
        content: JSON.stringify({
          exploration_notes_text: 'Continue monitoring established plantings and expand to adjacent areas',
          metrics_text: 'Track survival rates, growth measurements, and expansion progress',
          suggested_measurements: ['Survival rate tracking', 'Growth measurements', 'New area coverage'],
          comparison_areas: ['Original planting area', 'New expansion zones'],
          documentation_tips: ['Monthly photo series', 'Growth measurement logs', 'Species performance notes']
        }),
        confidence: 0.9,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockContextualResponse);

    const result = await aiContentService.generateExplorationSuggestions(requestWithExistingData);

    // Property: Context-aware suggestions should reference existing data
    expect(result).toBeTruthy();
    const content = result!.content;
    
    // Property: Suggestions should be more specific when context is provided
    expect(content.exploration_notes_text).toContain('monitoring');
    expect(content.metrics_text.length).toBeGreaterThan(50); // More detailed with context
    expect(content.suggested_measurements.length).toBeGreaterThan(2);

    // Property: High confidence when good context is available
    expect(result!.confidence).toBeGreaterThan(0.7);
  });

  it('should handle malformed AI responses gracefully', async () => {
    // Property: System should handle malformed AI responses without crashing
    const testRequest = {
      action_id: 'action-malformed',
      state_text: 'Test action for malformed response handling'
    };

    // Mock malformed AI response
    const malformedResponse = {
      data: {
        content: 'This is not valid JSON content for exploration suggestions',
        confidence: 0.7,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(malformedResponse);

    const result = await aiContentService.generateExplorationSuggestions(testRequest);

    // Property: Should still return structured response even with malformed AI content
    expect(result).toBeTruthy();
    expect(result?.content).toBeDefined();
    
    const content = result!.content;
    expect(content.exploration_notes_text).toBeTruthy();
    expect(content.metrics_text).toBeDefined();
    expect(Array.isArray(content.suggested_measurements)).toBe(true);
    expect(Array.isArray(content.comparison_areas)).toBe(true);
    expect(Array.isArray(content.documentation_tips)).toBe(true);

    // Property: Should use the malformed content as fallback text
    expect(content.exploration_notes_text).toContain('This is not valid JSON');
  });

  it('should validate AI service health before generating suggestions', async () => {
    // Property: Service should check AI availability and handle accordingly
    
    // Test when AI is available
    (apiService.get as any).mockResolvedValue({ status: 200 });
    const isAvailable = await aiContentService.isAvailable();
    expect(isAvailable).toBe(true);

    // Test when AI is unavailable
    (apiService.get as any).mockRejectedValue(new Error('Service down'));
    const isUnavailable = await aiContentService.isAvailable();
    expect(isUnavailable).toBe(false);
  });

  it('should generate suggestions with appropriate prompt structure', async () => {
    // Property: AI prompts should be well-structured and include all relevant context
    const testRequest = {
      action_id: 'action-prompt-test',
      state_text: 'Complex restoration project with multiple phases',
      policy_text: 'Multi-phase approach with stakeholder coordination',
      summary_policy_text: 'Coordinate phases with documentation at each step',
      existing_exploration_notes: 'Phase 1 completed successfully',
      existing_metrics: 'Phase 1: 100% completion, 3 weeks duration'
    };

    const mockResponse = {
      data: {
        content: JSON.stringify({
          exploration_notes_text: 'Document phase transitions and stakeholder feedback',
          metrics_text: 'Track phase completion rates and timeline adherence',
          suggested_measurements: ['Phase completion %', 'Timeline variance', 'Stakeholder satisfaction'],
          comparison_areas: ['Different phase approaches', 'Stakeholder engagement methods'],
          documentation_tips: ['Phase transition photos', 'Stakeholder meeting notes', 'Timeline tracking']
        }),
        confidence: 0.85,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockResponse);

    const result = await aiContentService.generateExplorationSuggestions(testRequest);

    // Property: Should call API with proper prompt structure
    expect(apiService.post).toHaveBeenCalledWith(
      '/ai/generate-exploration-suggestions',
      expect.objectContaining({
        prompt: expect.stringContaining('Generate exploration suggestions'),
        model: 'gpt-4',
        max_tokens: 800,
        temperature: 0.4,
        context: expect.objectContaining({
          type: 'exploration_suggestions',
          action_id: testRequest.action_id,
          state_text: testRequest.state_text,
          policy_text: testRequest.policy_text,
          existing_notes: testRequest.existing_exploration_notes,
          existing_metrics: testRequest.existing_metrics
        })
      })
    );

    // Property: Result should reflect the comprehensive context
    expect(result).toBeTruthy();
    expect(result!.content.exploration_notes_text).toContain('phase');
    expect(result!.content.suggested_measurements).toContain('Phase completion %');
  });
});