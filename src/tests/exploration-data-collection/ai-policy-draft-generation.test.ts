/**
 * Property Test: AI Policy Draft Generation
 * 
 * Property 6: Policy Draft Generation
 * Validates: Requirements 3.2
 * 
 * Tests that AI can generate comprehensive policy drafts from exploration data
 * that are suitable for organizational implementation.
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

describe('Property Test: AI Policy Draft Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate comprehensive policy drafts from exploration data', async () => {
    // Property: For any valid exploration data, AI should generate a complete policy draft
    const testCases = [
      {
        exploration_data: {
          exploration_code: 'SF010425EX001',
          exploration_notes_text: 'Tested new invasive species removal technique using targeted herbicide application. Method proved 90% effective with minimal environmental impact.',
          metrics_text: 'Effectiveness: 90%, Time saved: 40%, Environmental impact: Minimal, Cost reduction: 25%',
          action_title: 'Invasive Species Removal - New Technique',
          state_text: 'Large invasive plant population threatening native ecosystem'
        },
        similar_policies: [
          {
            title: 'Standard Invasive Species Protocol',
            description_text: 'Traditional manual removal methods with follow-up monitoring',
            status: 'active'
          }
        ]
      },
      {
        exploration_data: {
          exploration_code: 'SF010425EX002',
          exploration_notes_text: 'Implemented new trail maintenance approach using sustainable materials. Reduced erosion by 60% and improved visitor satisfaction.',
          metrics_text: 'Erosion reduction: 60%, Visitor satisfaction: +35%, Material cost: -20%, Maintenance frequency: -50%',
          action_title: 'Sustainable Trail Maintenance',
          state_text: 'Trail erosion causing safety concerns and environmental damage'
        }
      }
    ];

    // Mock successful AI responses
    const mockAIResponse = {
      data: {
        content: JSON.stringify({
          title: 'Enhanced Invasive Species Management Protocol',
          description_text: 'Comprehensive policy for targeted invasive species removal using proven techniques with minimal environmental impact',
          key_procedures: [
            'Conduct site assessment and species identification',
            'Apply targeted herbicide using precision equipment',
            'Monitor effectiveness and environmental impact',
            'Document results and adjust methods as needed'
          ],
          safety_requirements: [
            'Use appropriate PPE for chemical handling',
            'Follow EPA guidelines for herbicide application',
            'Maintain safety buffer zones around water sources'
          ],
          documentation_requirements: [
            'Pre and post-treatment photography',
            'Species identification and population estimates',
            'Treatment method and chemical usage logs',
            'Effectiveness monitoring reports'
          ],
          effective_conditions: [
            'When invasive species population exceeds 25% coverage',
            'During optimal weather conditions for treatment',
            'With trained personnel and proper equipment available'
          ]
        }),
        confidence: 0.9,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockAIResponse);

    for (const testCase of testCases) {
      const result = await aiContentService.generatePolicyDraft(testCase);

      // Property: AI should always return structured policy draft
      expect(result).toBeTruthy();
      expect(result?.content).toBeDefined();
      
      // Property: Policy draft should contain all required fields
      const content = result!.content;
      expect(content.title).toBeTruthy();
      expect(content.description_text).toBeTruthy();
      expect(Array.isArray(content.key_procedures)).toBe(true);
      expect(Array.isArray(content.safety_requirements)).toBe(true);
      expect(Array.isArray(content.documentation_requirements)).toBe(true);
      expect(Array.isArray(content.effective_conditions)).toBe(true);

      // Property: Content should be comprehensive and actionable
      expect(content.title.length).toBeGreaterThan(10);
      expect(content.description_text.length).toBeGreaterThan(50);
      expect(content.key_procedures.length).toBeGreaterThan(0);
      expect(content.safety_requirements.length).toBeGreaterThan(0);
      expect(content.documentation_requirements.length).toBeGreaterThan(0);
      expect(content.effective_conditions.length).toBeGreaterThan(0);

      // Property: Response should include metadata
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.model_used).toBeTruthy();
      expect(result!.generated_at).toBeTruthy();
      expect(Array.isArray(result!.context_used)).toBe(true);
    }
  });

  it('should incorporate exploration metrics into policy requirements', async () => {
    // Property: Policy drafts should reflect the quantitative results from exploration
    const explorationWithMetrics = {
      exploration_data: {
        exploration_code: 'SF010425EX003',
        exploration_notes_text: 'New restoration technique achieved 95% plant survival rate',
        metrics_text: 'Plant survival: 95%, Growth rate: 150% of baseline, Cost efficiency: +30%',
        action_title: 'High-Efficiency Restoration Method',
        state_text: 'Degraded habitat requiring restoration'
      }
    };

    const mockMetricsResponse = {
      data: {
        content: JSON.stringify({
          title: 'High-Efficiency Habitat Restoration Policy',
          description_text: 'Policy for implementing restoration methods that achieve 95% plant survival rates',
          key_procedures: [
            'Use proven planting techniques that achieve 95% survival rates',
            'Monitor growth rates to ensure 150% of baseline performance',
            'Implement cost-efficient methods with 30% improvement'
          ],
          safety_requirements: ['Standard restoration safety protocols'],
          documentation_requirements: [
            'Track plant survival rates monthly',
            'Document growth rate measurements',
            'Record cost efficiency metrics'
          ],
          effective_conditions: [
            'When restoration survival rates must exceed 90%',
            'For projects requiring cost efficiency improvements'
          ]
        }),
        confidence: 0.85,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockMetricsResponse);

    const result = await aiContentService.generatePolicyDraft(explorationWithMetrics);

    // Property: Policy should reference specific metrics from exploration
    expect(result).toBeTruthy();
    const content = result!.content;
    
    expect(content.description_text).toContain('95%');
    expect(content.key_procedures.some(proc => proc.includes('95%'))).toBe(true);
    expect(content.documentation_requirements.some(req => req.includes('survival'))).toBe(true);
  });

  it('should handle AI service unavailability with fallback policy drafts', async () => {
    // Property: When AI fails, fallback should provide basic but complete policy structure
    const testRequest = {
      exploration_data: {
        exploration_code: 'SF010425EX004',
        exploration_notes_text: 'Emergency response protocol tested during storm event',
        metrics_text: 'Response time: 2 hours, Effectiveness: High, Resource usage: Optimal',
        action_title: 'Emergency Storm Response',
        state_text: 'Storm damage requiring immediate response'
      }
    };

    // Mock AI service failure
    (apiService.post as any).mockRejectedValue(new Error('AI service unavailable'));

    const result = await aiContentService.generatePolicyDraft(testRequest);

    // Property: Fallback should still provide complete policy structure
    expect(result).toBeTruthy();
    expect(result?.content).toBeDefined();
    
    const content = result!.content;
    expect(content.title).toBeTruthy();
    expect(content.description_text).toBeTruthy();
    expect(Array.isArray(content.key_procedures)).toBe(true);
    expect(Array.isArray(content.safety_requirements)).toBe(true);
    expect(Array.isArray(content.documentation_requirements)).toBe(true);
    expect(Array.isArray(content.effective_conditions)).toBe(true);

    // Property: Fallback should be marked as such
    expect(result!.model_used).toBe('fallback');
    expect(result!.confidence).toBeLessThan(0.5); // Lower confidence for fallback
    expect(result!.context_used).toContain('fallback_generation');

    // Property: Fallback should include exploration code in title
    expect(content.title).toContain('Emergency Storm Response');
    expect(content.description_text).toContain('SF010425EX004');
  });

  it('should leverage similar policies when available', async () => {
    // Property: Policy drafts should reference and build upon similar existing policies
    const requestWithSimilarPolicies = {
      exploration_data: {
        exploration_code: 'SF010425EX005',
        exploration_notes_text: 'Improved water quality monitoring using new sensor technology',
        metrics_text: 'Accuracy: +40%, Cost: -25%, Monitoring frequency: +200%',
        action_title: 'Advanced Water Quality Monitoring',
        state_text: 'Water quality concerns requiring enhanced monitoring'
      },
      similar_policies: [
        {
          title: 'Standard Water Quality Protocol',
          description_text: 'Traditional monthly water testing using manual collection methods',
          status: 'active'
        },
        {
          title: 'Environmental Monitoring Guidelines',
          description_text: 'General guidelines for environmental data collection and reporting',
          status: 'active'
        }
      ]
    };

    const mockSimilarPolicyResponse = {
      data: {
        content: JSON.stringify({
          title: 'Enhanced Water Quality Monitoring Protocol',
          description_text: 'Advanced monitoring policy building on Standard Water Quality Protocol with 40% improved accuracy',
          key_procedures: [
            'Deploy sensor technology for continuous monitoring',
            'Integrate with existing Standard Water Quality Protocol',
            'Follow Environmental Monitoring Guidelines for reporting'
          ],
          safety_requirements: ['Maintain existing safety protocols from standard procedures'],
          documentation_requirements: [
            'Enhanced data collection per Environmental Monitoring Guidelines',
            'Sensor calibration and maintenance logs'
          ],
          effective_conditions: [
            'When enhanced accuracy is required beyond standard protocol',
            'For continuous monitoring applications'
          ]
        }),
        confidence: 0.9,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockSimilarPolicyResponse);

    const result = await aiContentService.generatePolicyDraft(requestWithSimilarPolicies);

    // Property: Policy should reference similar policies
    expect(result).toBeTruthy();
    const content = result!.content;
    
    expect(content.description_text).toContain('Standard Water Quality Protocol');
    expect(content.key_procedures.some(proc => proc.includes('Standard Water Quality Protocol'))).toBe(true);
    expect(content.documentation_requirements.some(req => req.includes('Environmental Monitoring Guidelines'))).toBe(true);

    // Property: Higher confidence when similar policies are available
    expect(result!.confidence).toBeGreaterThan(0.8);
  });

  it('should generate policies with appropriate organizational scope', async () => {
    // Property: Policy drafts should be suitable for organizational implementation
    const organizationalRequest = {
      exploration_data: {
        exploration_code: 'SF010425EX006',
        exploration_notes_text: 'Team coordination improvements reduced project completion time by 35%',
        metrics_text: 'Time reduction: 35%, Team satisfaction: +50%, Communication efficiency: +60%',
        action_title: 'Enhanced Team Coordination Protocol',
        state_text: 'Project delays due to coordination issues'
      }
    };

    const mockOrganizationalResponse = {
      data: {
        content: JSON.stringify({
          title: 'Organizational Team Coordination Policy',
          description_text: 'Organization-wide policy for enhanced team coordination reducing project completion time by 35%',
          key_procedures: [
            'Implement standardized communication protocols across all teams',
            'Establish regular coordination checkpoints for all projects',
            'Use proven coordination methods that achieve 35% time reduction'
          ],
          safety_requirements: [
            'Ensure coordination methods do not compromise safety protocols',
            'Maintain clear communication during emergency situations'
          ],
          documentation_requirements: [
            'Document coordination effectiveness metrics for all projects',
            'Track team satisfaction and communication efficiency',
            'Report coordination improvements quarterly'
          ],
          effective_conditions: [
            'For all multi-person projects organization-wide',
            'When project coordination efficiency is below target',
            'During implementation of new team structures'
          ]
        }),
        confidence: 0.85,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockOrganizationalResponse);

    const result = await aiContentService.generatePolicyDraft(organizationalRequest);

    // Property: Policy should have organizational scope and applicability
    expect(result).toBeTruthy();
    const content = result!.content;
    
    expect(content.title).toContain('Organizational');
    expect(content.description_text).toContain('organization-wide');
    expect(content.effective_conditions.some(cond => cond.includes('organization-wide'))).toBe(true);
    expect(content.key_procedures.some(proc => proc.includes('all teams'))).toBe(true);
  });

  it('should handle malformed AI responses gracefully', async () => {
    // Property: System should handle malformed AI responses without crashing
    const testRequest = {
      exploration_data: {
        exploration_code: 'SF010425EX007',
        exploration_notes_text: 'Test exploration for malformed response handling',
        metrics_text: 'Test metrics',
        action_title: 'Test Action',
        state_text: 'Test state'
      }
    };

    // Mock malformed AI response
    const malformedResponse = {
      data: {
        content: 'This is not valid JSON content for policy draft generation',
        confidence: 0.7,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(malformedResponse);

    const result = await aiContentService.generatePolicyDraft(testRequest);

    // Property: Should still return structured response even with malformed AI content
    expect(result).toBeTruthy();
    expect(result?.content).toBeDefined();
    
    const content = result!.content;
    expect(content.title).toBeTruthy();
    expect(content.description_text).toBeTruthy();
    expect(Array.isArray(content.key_procedures)).toBe(true);
    expect(Array.isArray(content.safety_requirements)).toBe(true);
    expect(Array.isArray(content.documentation_requirements)).toBe(true);
    expect(Array.isArray(content.effective_conditions)).toBe(true);

    // Property: Should use the malformed content as fallback text
    expect(content.description_text).toContain('This is not valid JSON');
  });

  it('should generate appropriate prompts with all context information', async () => {
    // Property: AI prompts should include all relevant exploration and policy context
    const comprehensiveRequest = {
      exploration_data: {
        exploration_code: 'SF010425EX008',
        exploration_notes_text: 'Comprehensive restoration project with multiple stakeholder coordination',
        metrics_text: 'Stakeholder satisfaction: 95%, Project efficiency: +45%, Cost savings: 20%',
        action_title: 'Multi-Stakeholder Restoration Project',
        state_text: 'Large-scale habitat restoration requiring coordination'
      },
      similar_policies: [
        {
          title: 'Stakeholder Engagement Policy',
          description_text: 'Guidelines for engaging multiple stakeholders in environmental projects',
          status: 'active'
        }
      ]
    };

    const mockResponse = {
      data: {
        content: JSON.stringify({
          title: 'Multi-Stakeholder Environmental Project Policy',
          description_text: 'Comprehensive policy for coordinating large-scale environmental projects with multiple stakeholders',
          key_procedures: ['Stakeholder identification and engagement', 'Coordination protocols', 'Progress monitoring'],
          safety_requirements: ['Multi-party safety coordination'],
          documentation_requirements: ['Stakeholder communication logs', 'Project progress reports'],
          effective_conditions: ['For projects involving multiple stakeholders', 'When coordination efficiency is critical']
        }),
        confidence: 0.9,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValue(mockResponse);

    const result = await aiContentService.generatePolicyDraft(comprehensiveRequest);

    // Property: Should call API with comprehensive prompt structure
    expect(apiService.post).toHaveBeenCalledWith(
      '/ai/generate-policy-draft',
      expect.objectContaining({
        prompt: expect.stringContaining('Generate a policy draft based on the following exploration data'),
        model: 'gpt-4',
        max_tokens: 1000,
        temperature: 0.2,
        context: expect.objectContaining({
          type: 'policy_draft_generation',
          exploration_code: comprehensiveRequest.exploration_data.exploration_code,
          exploration_notes: comprehensiveRequest.exploration_data.exploration_notes_text,
          metrics: comprehensiveRequest.exploration_data.metrics_text,
          similar_policies_count: 1
        })
      })
    );

    // Property: Result should reflect the comprehensive context
    expect(result).toBeTruthy();
    expect(result!.content.title).toContain('Multi-Stakeholder');
    expect(result!.content.description_text).toContain('stakeholders');
  });
});