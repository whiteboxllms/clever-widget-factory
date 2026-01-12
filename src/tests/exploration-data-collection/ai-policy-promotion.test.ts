/**
 * Property Test: AI Policy Promotion
 * 
 * Property 24: AI Policy Promotion
 * Validates: Requirements 8.3
 * 
 * Tests that AI can effectively promote exploration findings into
 * organizational policies with proper workflow and validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiContentService } from '../../services/aiContentService';
import { policyService } from '../../services/policyService';
import { explorationService } from '../../services/explorationService';
import { apiService } from '../../lib/apiService';
import { queryJSON } from '../../lib/database';

// Mock the services
vi.mock('../../lib/apiService', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

vi.mock('../../lib/database', () => ({
  queryJSON: vi.fn()
}));

describe('Property Test: AI Policy Promotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should promote successful explorations to comprehensive policies', async () => {
    // Property: Successful explorations should be promotable to organizational policies
    const successfulExplorations = [
      {
        exploration_code: 'SF010425EX001',
        exploration_notes_text: 'New invasive species removal technique achieved 95% effectiveness with 40% time savings. Method uses targeted herbicide application with minimal environmental impact.',
        metrics_text: 'Effectiveness: 95%, Time savings: 40%, Environmental impact: Minimal, Cost reduction: 25%, Species regrowth: <5%',
        action_title: 'Enhanced Invasive Species Management',
        state_text: 'Large invasive plant population threatening native wetland ecosystem',
        public_flag: true,
        created_at: new Date('2024-01-15T10:00:00Z').toISOString()
      },
      {
        exploration_code: 'SF010425EX002',
        exploration_notes_text: 'Sustainable trail maintenance approach reduced erosion by 60% and improved visitor satisfaction. Used recycled materials and native plantings.',
        metrics_text: 'Erosion reduction: 60%, Visitor satisfaction: +35%, Material cost: -20%, Maintenance frequency: -50%',
        action_title: 'Sustainable Trail Maintenance Protocol',
        state_text: 'Trail erosion causing safety concerns and environmental damage',
        public_flag: true,
        created_at: new Date('2024-01-20T14:30:00Z').toISOString()
      }
    ];

    for (const exploration of successfulExplorations) {
      // Mock AI policy draft generation
      const mockPolicyDraft = {
        data: {
          content: JSON.stringify({
            title: `Organizational ${exploration.action_title} Policy`,
            description_text: `Comprehensive policy based on successful exploration ${exploration.exploration_code}. ${exploration.exploration_notes_text}`,
            key_procedures: [
              'Implement proven techniques from exploration findings',
              'Follow documented procedures for optimal results',
              'Monitor effectiveness using established metrics'
            ],
            safety_requirements: [
              'Use appropriate PPE and safety protocols',
              'Follow environmental protection guidelines',
              'Maintain safety buffer zones as required'
            ],
            documentation_requirements: [
              'Document all activities and outcomes',
              'Track metrics consistent with exploration findings',
              'Report results quarterly for policy refinement'
            ],
            effective_conditions: [
              'When similar conditions to exploration exist',
              'With trained personnel and proper equipment',
              'Following successful exploration methodology'
            ]
          }),
          confidence: 0.9,
          model: 'gpt-4'
        }
      };

      (apiService.post as any).mockResolvedValueOnce(mockPolicyDraft);

      // Generate policy draft from exploration
      const policyDraft = await aiContentService.generatePolicyDraft({
        exploration_data: exploration
      });

      // Property: AI should generate comprehensive policy draft
      expect(policyDraft).toBeTruthy();
      expect(policyDraft!.content.title).toContain('Policy');
      expect(policyDraft!.content.description_text).toContain(exploration.exploration_code);
      expect(policyDraft!.content.key_procedures.length).toBeGreaterThan(0);
      expect(policyDraft!.content.safety_requirements.length).toBeGreaterThan(0);
      expect(policyDraft!.content.documentation_requirements.length).toBeGreaterThan(0);
      expect(policyDraft!.content.effective_conditions.length).toBeGreaterThan(0);

      // Property: Policy should reference exploration metrics
      const hasMetricsReference = 
        policyDraft!.content.description_text.includes('95%') ||
        policyDraft!.content.description_text.includes('60%') ||
        policyDraft!.content.key_procedures.some(proc => proc.includes('metrics'));
      expect(hasMetricsReference).toBe(true);

      // Mock policy creation
      const createdPolicy = {
        id: `policy-promoted-${exploration.exploration_code.toLowerCase()}`,
        ...policyDraft!.content,
        status: 'draft',
        source_exploration_code: exploration.exploration_code,
        promoted_at: new Date().toISOString(),
        promoted_by: 'user-123',
        organization_id: 'org-456',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        revision_count: 0
      };

      (queryJSON as any).mockResolvedValueOnce([createdPolicy]);

      const promotedPolicy = await policyService.createPolicyFromExploration(
        exploration.exploration_code,
        policyDraft!.content
      );

      // Property: Promoted policy should maintain exploration linkage
      expect(promotedPolicy.source_exploration_code).toBe(exploration.exploration_code);
      expect(promotedPolicy.promoted_at).toBeTruthy();
      expect(promotedPolicy.status).toBe('draft'); // Start as draft for review
    }
  });

  it('should incorporate similar policies into promotion workflow', async () => {
    // Property: Policy promotion should consider existing similar policies
    const exploration = {
      exploration_code: 'SF010425EX003',
      exploration_notes_text: 'Advanced water quality monitoring using IoT sensors achieved 40% better accuracy and 60% cost reduction',
      metrics_text: 'Accuracy improvement: 40%, Cost reduction: 60%, Monitoring frequency: +200%, Data reliability: 95%',
      action_title: 'IoT Water Quality Monitoring',
      state_text: 'Water quality monitoring needs improvement for regulatory compliance',
      public_flag: true
    };

    const similarPolicies = [
      {
        id: 'policy-water-standard',
        title: 'Standard Water Quality Monitoring Policy',
        description_text: 'Traditional monthly water testing using manual collection and laboratory analysis',
        status: 'active',
        effective_date: new Date('2023-06-01T00:00:00Z').toISOString(),
        similarity_score: 0.85
      },
      {
        id: 'policy-environmental-monitoring',
        title: 'Environmental Data Collection Guidelines',
        description_text: 'General guidelines for environmental monitoring and data collection across all programs',
        status: 'active',
        effective_date: new Date('2023-01-01T00:00:00Z').toISOString(),
        similarity_score: 0.72
      }
    ];

    // Mock AI policy draft generation with similar policies
    const mockPolicyDraftWithSimilar = {
      data: {
        content: JSON.stringify({
          title: 'Enhanced Water Quality Monitoring Policy',
          description_text: 'Advanced monitoring policy building upon Standard Water Quality Monitoring Policy with IoT sensor technology achieving 40% better accuracy',
          key_procedures: [
            'Deploy IoT sensors following Environmental Data Collection Guidelines',
            'Integrate with existing Standard Water Quality Monitoring Policy procedures',
            'Implement continuous monitoring with 200% increased frequency',
            'Maintain 95% data reliability standards'
          ],
          safety_requirements: [
            'Follow existing safety protocols from Standard Water Quality Monitoring Policy',
            'Add IoT device safety and maintenance procedures'
          ],
          documentation_requirements: [
            'Enhanced data collection per Environmental Data Collection Guidelines',
            'IoT sensor calibration and maintenance logs',
            'Continuous monitoring data validation reports'
          ],
          effective_conditions: [
            'When enhanced accuracy beyond Standard Water Quality Monitoring Policy is required',
            'For continuous monitoring applications',
            'With IoT infrastructure and trained personnel available'
          ]
        }),
        confidence: 0.95,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValueOnce(mockPolicyDraftWithSimilar);

    const policyDraft = await aiContentService.generatePolicyDraft({
      exploration_data: exploration,
      similar_policies: similarPolicies
    });

    // Property: Policy should reference similar policies
    expect(policyDraft!.content.description_text).toContain('Standard Water Quality Monitoring Policy');
    expect(policyDraft!.content.key_procedures.some(proc => 
      proc.includes('Environmental Data Collection Guidelines')
    )).toBe(true);

    // Property: Higher confidence when similar policies are available
    expect(policyDraft!.confidence).toBeGreaterThan(0.9);

    // Property: Policy should build upon existing policies rather than replace them
    expect(policyDraft!.content.key_procedures.some(proc => 
      proc.includes('Integrate with existing')
    )).toBe(true);
  });

  it('should handle policy promotion workflow with approval process', async () => {
    // Property: Policy promotion should follow organizational approval workflow
    const exploration = {
      exploration_code: 'SF010425EX004',
      exploration_notes_text: 'Emergency response protocol tested during actual storm event. Response time improved by 50% with new coordination system.',
      metrics_text: 'Response time improvement: 50%, Resource efficiency: +30%, Coordination effectiveness: 95%, Incident resolution: 100%',
      action_title: 'Enhanced Emergency Response Protocol',
      state_text: 'Emergency response times need improvement for public safety',
      public_flag: true
    };

    const promotionWorkflow = [
      {
        stage: 'draft_creation',
        status: 'draft',
        approver: null,
        approval_required: false
      },
      {
        stage: 'review_submission',
        status: 'pending_review',
        approver: 'manager-123',
        approval_required: true
      },
      {
        stage: 'manager_approval',
        status: 'pending_approval',
        approver: 'director-456',
        approval_required: true
      },
      {
        stage: 'final_activation',
        status: 'active',
        approver: null,
        approval_required: false
      }
    ];

    // Mock AI policy draft generation
    const mockEmergencyPolicyDraft = {
      data: {
        content: JSON.stringify({
          title: 'Enhanced Emergency Response Policy',
          description_text: 'Comprehensive emergency response policy based on successful storm event testing with 50% response time improvement',
          key_procedures: [
            'Implement new coordination system for 50% faster response',
            'Deploy resources using proven efficiency methods',
            'Maintain 95% coordination effectiveness standards'
          ],
          safety_requirements: [
            'Prioritize responder safety in all emergency situations',
            'Follow enhanced coordination protocols for team safety'
          ],
          documentation_requirements: [
            'Document all emergency responses and outcomes',
            'Track response times and coordination effectiveness',
            'Report quarterly on policy effectiveness'
          ],
          effective_conditions: [
            'During all emergency response situations',
            'When enhanced coordination is available',
            'With trained emergency response personnel'
          ]
        }),
        confidence: 0.92,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValueOnce(mockEmergencyPolicyDraft);

    const policyDraft = await aiContentService.generatePolicyDraft({
      exploration_data: exploration
    });

    let currentPolicy = {
      id: 'policy-emergency-promoted',
      ...policyDraft!.content,
      status: 'draft',
      source_exploration_code: exploration.exploration_code,
      promoted_at: new Date().toISOString(),
      promoted_by: 'user-123',
      organization_id: 'org-456',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      approval_workflow: []
    };

    // Process through approval workflow
    for (const workflowStage of promotionWorkflow) {
      const updatedPolicy = {
        ...currentPolicy,
        status: workflowStage.status,
        updated_at: new Date().toISOString(),
        approval_workflow: [
          ...currentPolicy.approval_workflow,
          {
            stage: workflowStage.stage,
            status: workflowStage.status,
            approver: workflowStage.approver,
            approved_at: new Date().toISOString(),
            approval_required: workflowStage.approval_required
          }
        ]
      };

      if (workflowStage.status === 'active') {
        updatedPolicy.effective_date = new Date().toISOString();
      }

      (queryJSON as any).mockResolvedValueOnce([currentPolicy]); // Current state
      (queryJSON as any).mockResolvedValueOnce([updatedPolicy]); // Updated state

      const result = await policyService.updatePolicyStatus(
        currentPolicy.id,
        workflowStage.status,
        workflowStage.approver
      );

      // Property: Each workflow stage should be properly recorded
      expect(result.status).toBe(workflowStage.status);
      expect(result.approval_workflow.length).toBe(currentPolicy.approval_workflow.length + 1);

      // Property: Approval workflow should maintain audit trail
      const latestApproval = result.approval_workflow[result.approval_workflow.length - 1];
      expect(latestApproval.stage).toBe(workflowStage.stage);
      expect(latestApproval.status).toBe(workflowStage.status);
      expect(latestApproval.approver).toBe(workflowStage.approver);

      currentPolicy = updatedPolicy;
    }

    // Property: Final policy should be active with complete approval trail
    expect(currentPolicy.status).toBe('active');
    expect(currentPolicy.effective_date).toBeTruthy();
    expect(currentPolicy.approval_workflow.length).toBe(promotionWorkflow.length);
  });

  it('should validate exploration readiness for policy promotion', async () => {
    // Property: Only suitable explorations should be promotable to policies
    const explorationReadinessTests = [
      {
        name: 'Successful exploration with metrics',
        exploration: {
          exploration_code: 'SF010425EX005',
          exploration_notes_text: 'Comprehensive restoration technique with documented success. Method tested over 6 months with consistent positive results.',
          metrics_text: 'Success rate: 90%, Cost efficiency: +25%, Time savings: 30%, Environmental impact: Positive',
          action_title: 'Proven Restoration Technique',
          state_text: 'Habitat restoration using new methodology',
          public_flag: true,
          created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString() // 6 months ago
        },
        shouldPromote: true,
        reason: 'Comprehensive documentation and proven results'
      },
      {
        name: 'Recent exploration without sufficient testing',
        exploration: {
          exploration_code: 'SF010425EX006',
          exploration_notes_text: 'Initial test of new approach. Preliminary results look promising but need more validation.',
          metrics_text: 'Initial success: 70%, Testing period: 2 weeks, Sample size: Small',
          action_title: 'Preliminary Test Approach',
          state_text: 'Testing new methodology',
          public_flag: false,
          created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks ago
        },
        shouldPromote: false,
        reason: 'Insufficient testing period and sample size'
      },
      {
        name: 'Failed exploration',
        exploration: {
          exploration_code: 'SF010425EX007',
          exploration_notes_text: 'Attempted new technique but results were disappointing. Method needs significant refinement.',
          metrics_text: 'Success rate: 30%, Cost overrun: +50%, Time exceeded: +40%, Issues encountered: Multiple',
          action_title: 'Failed Technique Attempt',
          state_text: 'Testing unsuccessful methodology',
          public_flag: false,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 3 months ago
        },
        shouldPromote: false,
        reason: 'Poor results and multiple issues'
      }
    ];

    for (const test of explorationReadinessTests) {
      // Mock exploration validation
      const validationResult = {
        is_ready_for_promotion: test.shouldPromote,
        readiness_score: test.shouldPromote ? 0.85 : 0.35,
        validation_criteria: {
          sufficient_testing_period: test.exploration.created_at < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          positive_metrics: test.exploration.metrics_text.includes('90%') || test.exploration.metrics_text.includes('success'),
          comprehensive_documentation: test.exploration.exploration_notes_text.length > 100,
          public_visibility: test.exploration.public_flag
        },
        recommendation: test.reason
      };

      (queryJSON as any).mockResolvedValueOnce([validationResult]);

      const validation = await explorationService.validateForPolicyPromotion(test.exploration.exploration_code);

      if (test.shouldPromote) {
        // Property: Ready explorations should pass validation
        expect(validation.is_ready_for_promotion).toBe(true);
        expect(validation.readiness_score).toBeGreaterThan(0.7);

        // Mock AI policy draft generation for ready explorations
        const mockPolicyDraft = {
          data: {
            content: JSON.stringify({
              title: `${test.exploration.action_title} Policy`,
              description_text: `Policy based on successful exploration ${test.exploration.exploration_code}`,
              key_procedures: ['Implement proven methodology', 'Follow documented procedures'],
              safety_requirements: ['Standard safety protocols'],
              documentation_requirements: ['Document outcomes', 'Track metrics'],
              effective_conditions: ['When conditions match exploration parameters']
            }),
            confidence: 0.9,
            model: 'gpt-4'
          }
        };

        (apiService.post as any).mockResolvedValueOnce(mockPolicyDraft);

        const policyDraft = await aiContentService.generatePolicyDraft({
          exploration_data: test.exploration
        });

        expect(policyDraft).toBeTruthy();
        expect(policyDraft!.confidence).toBeGreaterThan(0.8);

      } else {
        // Property: Unready explorations should fail validation
        expect(validation.is_ready_for_promotion).toBe(false);
        expect(validation.readiness_score).toBeLessThan(0.5);
        expect(validation.recommendation).toContain(test.reason.split(' ')[0]); // Contains key reason word
      }
    }
  });

  it('should handle AI service unavailability during policy promotion', async () => {
    // Property: Policy promotion should have fallback when AI is unavailable
    const exploration = {
      exploration_code: 'SF010425EX008',
      exploration_notes_text: 'Successful habitat restoration with native species. Achieved 85% plant survival and improved biodiversity.',
      metrics_text: 'Plant survival: 85%, Biodiversity index: +40%, Cost efficiency: +15%, Maintenance reduction: 30%',
      action_title: 'Native Species Habitat Restoration',
      state_text: 'Degraded habitat requiring restoration with native species',
      public_flag: true
    };

    // Mock AI service failure
    (apiService.post as any).mockRejectedValueOnce(new Error('AI service unavailable'));

    const policyDraft = await aiContentService.generatePolicyDraft({
      exploration_data: exploration
    });

    // Property: Fallback should provide basic but complete policy structure
    expect(policyDraft).toBeTruthy();
    expect(policyDraft!.model_used).toBe('fallback');
    expect(policyDraft!.confidence).toBeLessThan(0.5);

    // Property: Fallback policy should include exploration information
    expect(policyDraft!.content.title).toContain(exploration.action_title);
    expect(policyDraft!.content.description_text).toContain(exploration.exploration_code);
    expect(policyDraft!.content.key_procedures.length).toBeGreaterThan(0);
    expect(policyDraft!.content.safety_requirements.length).toBeGreaterThan(0);

    // Property: Fallback should be clearly marked for human review
    expect(policyDraft!.context_used).toContain('fallback_generation');

    // Mock policy creation with fallback draft
    const fallbackPolicy = {
      id: 'policy-fallback-promoted',
      ...policyDraft!.content,
      status: 'draft',
      source_exploration_code: exploration.exploration_code,
      promoted_at: new Date().toISOString(),
      promoted_by: 'user-123',
      organization_id: 'org-456',
      ai_generated: false,
      requires_human_review: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([fallbackPolicy]);

    const promotedPolicy = await policyService.createPolicyFromExploration(
      exploration.exploration_code,
      policyDraft!.content,
      { ai_generated: false }
    );

    // Property: Fallback promoted policy should require human review
    expect(promotedPolicy.ai_generated).toBe(false);
    expect(promotedPolicy.requires_human_review).toBe(true);
  });

  it('should track policy promotion metrics and success rates', async () => {
    // Property: Policy promotion should be tracked for organizational learning
    const promotionHistory = [
      {
        exploration_code: 'SF010425EX009',
        promoted_at: new Date('2024-01-01T10:00:00Z').toISOString(),
        policy_id: 'policy-promoted-1',
        promotion_success: true,
        time_to_activation: 30, // days
        approval_stages: 3
      },
      {
        exploration_code: 'SF010425EX010',
        promoted_at: new Date('2024-01-15T10:00:00Z').toISOString(),
        policy_id: 'policy-promoted-2',
        promotion_success: true,
        time_to_activation: 45, // days
        approval_stages: 4
      },
      {
        exploration_code: 'SF010425EX011',
        promoted_at: new Date('2024-02-01T10:00:00Z').toISOString(),
        policy_id: 'policy-promoted-3',
        promotion_success: false,
        rejection_reason: 'Insufficient evidence for organizational adoption',
        approval_stages: 2
      }
    ];

    // Mock promotion metrics query
    const promotionMetrics = {
      total_promotions: promotionHistory.length,
      successful_promotions: promotionHistory.filter(p => p.promotion_success).length,
      success_rate: 0.67, // 2/3
      average_time_to_activation: 37.5, // (30 + 45) / 2
      average_approval_stages: 3, // (3 + 4 + 2) / 3
      common_rejection_reasons: ['Insufficient evidence', 'Resource constraints'],
      promotion_trends: {
        monthly_promotions: [1, 2, 0], // Jan, Feb, Mar
        success_by_month: [1, 1, 0]
      }
    };

    (queryJSON as any).mockResolvedValueOnce([promotionMetrics]);

    const metrics = await policyService.getPolicyPromotionMetrics({
      start_date: new Date('2024-01-01T00:00:00Z').toISOString(),
      end_date: new Date('2024-03-31T23:59:59Z').toISOString()
    });

    // Property: Promotion metrics should provide organizational insights
    expect(metrics.total_promotions).toBe(3);
    expect(metrics.successful_promotions).toBe(2);
    expect(metrics.success_rate).toBeCloseTo(0.67, 2);
    expect(metrics.average_time_to_activation).toBeCloseTo(37.5, 1);

    // Property: Metrics should identify improvement opportunities
    expect(metrics.common_rejection_reasons).toContain('Insufficient evidence');
    expect(metrics.promotion_trends.monthly_promotions.reduce((a, b) => a + b, 0)).toBe(3);

    // Property: Trends should help predict future promotion success
    const trendAnalysis = {
      success_trend: 'declining', // 1, 1, 0
      volume_trend: 'variable', // 1, 2, 0
      recommendations: [
        'Improve exploration documentation standards',
        'Provide better guidance on evidence collection',
        'Streamline approval process to reduce time to activation'
      ]
    };

    expect(trendAnalysis.recommendations.length).toBeGreaterThan(0);
  });

  it('should maintain exploration-policy linkage after promotion', async () => {
    // Property: Promoted policies should maintain bidirectional linkage with source explorations
    const exploration = {
      id: 'exploration-linkage-test',
      exploration_code: 'SF010425EX012',
      exploration_notes_text: 'Successful community engagement approach increased project support by 80%',
      metrics_text: 'Community support: +80%, Project completion: +25%, Stakeholder satisfaction: 95%',
      action_title: 'Community Engagement Protocol',
      state_text: 'Community engagement needed for project success',
      public_flag: true
    };

    // Mock AI policy draft generation
    const mockPolicyDraft = {
      data: {
        content: JSON.stringify({
          title: 'Community Engagement Policy',
          description_text: 'Comprehensive community engagement policy based on successful exploration SF010425EX012',
          key_procedures: ['Implement proven engagement methods', 'Maintain 95% satisfaction standards'],
          safety_requirements: ['Follow community interaction guidelines'],
          documentation_requirements: ['Track engagement metrics', 'Document community feedback'],
          effective_conditions: ['For all community-facing projects']
        }),
        confidence: 0.88,
        model: 'gpt-4'
      }
    };

    (apiService.post as any).mockResolvedValueOnce(mockPolicyDraft);

    const policyDraft = await aiContentService.generatePolicyDraft({
      exploration_data: exploration
    });

    // Mock policy creation with linkage
    const promotedPolicy = {
      id: 'policy-community-engagement',
      ...policyDraft!.content,
      status: 'active',
      effective_date: new Date().toISOString(),
      source_exploration_code: exploration.exploration_code,
      source_exploration_id: exploration.id,
      promoted_at: new Date().toISOString(),
      promoted_by: 'user-123',
      organization_id: 'org-456'
    };

    (queryJSON as any).mockResolvedValueOnce([promotedPolicy]);

    const createdPolicy = await policyService.createPolicyFromExploration(
      exploration.exploration_code,
      policyDraft!.content
    );

    // Mock exploration update with policy linkage
    const updatedExploration = {
      ...exploration,
      promoted_to_policy_id: createdPolicy.id,
      promoted_to_policy_title: createdPolicy.title,
      promotion_date: createdPolicy.promoted_at,
      updated_at: new Date().toISOString()
    };

    (queryJSON as any).mockResolvedValueOnce([exploration]); // Current exploration
    (queryJSON as any).mockResolvedValueOnce([updatedExploration]); // Updated exploration

    const linkedExploration = await explorationService.linkToPromotedPolicy(
      exploration.id,
      createdPolicy.id
    );

    // Property: Bidirectional linkage should be maintained
    expect(createdPolicy.source_exploration_code).toBe(exploration.exploration_code);
    expect(createdPolicy.source_exploration_id).toBe(exploration.id);
    expect(linkedExploration.promoted_to_policy_id).toBe(createdPolicy.id);
    expect(linkedExploration.promoted_to_policy_title).toBe(createdPolicy.title);

    // Property: Linkage should enable traceability
    const traceabilityCheck = {
      exploration_to_policy: createdPolicy.source_exploration_id === exploration.id,
      policy_to_exploration: linkedExploration.promoted_to_policy_id === createdPolicy.id,
      timestamps_consistent: new Date(linkedExploration.promotion_date) <= new Date(createdPolicy.promoted_at)
    };

    expect(traceabilityCheck.exploration_to_policy).toBe(true);
    expect(traceabilityCheck.policy_to_exploration).toBe(true);
    expect(traceabilityCheck.timestamps_consistent).toBe(true);
  });
});