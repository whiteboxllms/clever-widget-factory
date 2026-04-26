import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AxisDrilldown } from './AxisDrilldown';
import type { AxisDrilldownProps } from './AxisDrilldown';
import type { CapabilityProfile, AxisEvidence, ObservationEvidence } from '@/hooks/useCapability';
import type { SkillProfile } from '@/hooks/useSkillProfile';

// --- Mocks ---

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useLearning', () => ({
  useLearningObjectives: () => ({ data: null }),
}));

vi.mock('@/lib/imageUtils', () => ({
  getThumbnailUrl: (url: string) => url,
  getImageUrl: (url: string) => url,
}));

// --- Helpers ---

function makeSkillProfile(overrides?: Partial<SkillProfile>): SkillProfile {
  return {
    id: 'sp-1',
    action_id: 'action-1',
    narrative: 'Skill profile narrative',
    axes: [
      {
        key: 'water_chemistry',
        label: 'Water Chemistry',
        required_level: 3,
        description: 'Testing water chemistry',
      },
    ],
    ...overrides,
  } as SkillProfile;
}

function makeAxisEvidence(overrides?: Partial<AxisEvidence>): AxisEvidence {
  return {
    observation_id: 'ae-1',
    text_excerpt: 'Quiz answer about water ratios',
    similarity_score: 0.89,
    evidence_type: 'quiz',
    source_action_title: 'Concrete Foundation Work',
    ...overrides,
  };
}

function makeObservationEvidence(overrides?: Partial<ObservationEvidence>): ObservationEvidence {
  return {
    observation_id: 'obs-1',
    action_id: 'action-2',
    action_title: 'Field Observation',
    text_excerpt: 'Observed water testing procedure',
    photo_urls: [],
    captured_at: '2024-01-15T10:00:00Z',
    relevance_score: 0.75,
    ...overrides,
  };
}

function makeCapabilityProfile(overrides?: Partial<CapabilityProfile> & {
  axisOverrides?: Record<string, any>;
}): CapabilityProfile {
  const { axisOverrides, ...rest } = overrides || {};
  return {
    user_id: 'user-1',
    user_name: 'Test User',
    action_id: 'action-1',
    narrative: 'Overall profile narrative',
    axes: [
      {
        key: 'water_chemistry',
        label: 'Water Chemistry',
        level: 2,
        evidence_count: 3,
        evidence: [],
        axis_evidence: [],
        axis_narrative: '',
        ...axisOverrides,
      },
    ],
    total_evidence_count: 3,
    computed_at: '2024-01-15T10:00:00Z',
    ...rest,
  };
}

function renderAxisDrilldown(overrides?: Partial<AxisDrilldownProps>) {
  const defaultProps: AxisDrilldownProps = {
    actionId: 'action-1',
    axisKey: 'water_chemistry',
    skillProfile: makeSkillProfile(),
    capabilityProfiles: [makeCapabilityProfile()],
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  };

  return render(<AxisDrilldown {...defaultProps} />);
}

// --- Tests ---

describe('AxisDrilldown', () => {
  describe('per-axis evidence display (8.1)', () => {
    it('renders per-axis evidence with similarity scores and evidence type badges', () => {
      const axisEvidence = [
        makeAxisEvidence({
          observation_id: 'ae-1',
          similarity_score: 0.89,
          evidence_type: 'quiz',
          text_excerpt: 'Water-cement ratio understanding',
          source_action_title: 'Concrete Foundation Work',
        }),
        makeAxisEvidence({
          observation_id: 'ae-2',
          similarity_score: 0.72,
          evidence_type: 'observation',
          text_excerpt: 'Observed water testing in field',
          source_action_title: 'Field Water Testing',
        }),
      ];

      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({ axisOverrides: { axis_evidence: axisEvidence } }),
        ],
      });

      // Similarity scores as percentages
      expect(screen.getByText('89%')).toBeInTheDocument();
      expect(screen.getByText('72%')).toBeInTheDocument();

      // Evidence type badges
      expect(screen.getByText('Quiz')).toBeInTheDocument();
      expect(screen.getByText('Observation')).toBeInTheDocument();

      // Source text excerpts
      expect(screen.getByText('Water-cement ratio understanding')).toBeInTheDocument();
      expect(screen.getByText('Observed water testing in field')).toBeInTheDocument();

      // Source action titles
      expect(screen.getByText('Concrete Foundation Work')).toBeInTheDocument();
      expect(screen.getByText('Field Water Testing')).toBeInTheDocument();

      // Section label
      expect(screen.getByText('Per-axis evidence matches')).toBeInTheDocument();
    });
  });

  describe('axis narrative display (8.2)', () => {
    it('displays axis_narrative from Bedrock when available', () => {
      const narrative = 'Strong transfer from prior concrete work — quiz completion on water-cement ratios demonstrates Understand-level knowledge.';

      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({ axisOverrides: { axis_narrative: narrative } }),
        ],
      });

      expect(screen.getByText(narrative)).toBeInTheDocument();
    });
  });

  describe('graceful degradation (8.3)', () => {
    it('falls back to observation evidence when axis_evidence is empty', () => {
      const obsEvidence = [
        makeObservationEvidence({
          observation_id: 'obs-1',
          action_title: 'Field Observation',
          text_excerpt: 'Observed water testing procedure',
        }),
      ];

      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({
            axisOverrides: {
              axis_evidence: [],
              evidence: obsEvidence,
            },
          }),
        ],
      });

      // Should show observation evidence, not per-axis section label
      expect(screen.queryByText('Per-axis evidence matches')).not.toBeInTheDocument();
      expect(screen.getByText('Observed water testing procedure')).toBeInTheDocument();
      expect(screen.getByText('Field Observation')).toBeInTheDocument();
    });

    it('falls back to observation evidence when axis_evidence is missing/undefined', () => {
      const obsEvidence = [
        makeObservationEvidence({ text_excerpt: 'Fallback observation text' }),
      ];

      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({
            axisOverrides: {
              axis_evidence: undefined,
              evidence: obsEvidence,
            },
          }),
        ],
      });

      expect(screen.queryByText('Per-axis evidence matches')).not.toBeInTheDocument();
      expect(screen.getByText('Fallback observation text')).toBeInTheDocument();
    });

    it('falls back to profile narrative when axis_narrative is empty', () => {
      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({
            narrative: 'Overall profile narrative',
            axisOverrides: { axis_narrative: '' },
          }),
        ],
      });

      expect(screen.getByText('Overall profile narrative')).toBeInTheDocument();
    });

    it('falls back to profile narrative when axis_narrative is missing/undefined', () => {
      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({
            narrative: 'Fallback profile narrative',
            axisOverrides: { axis_narrative: undefined },
          }),
        ],
      });

      expect(screen.getByText('Fallback profile narrative')).toBeInTheDocument();
    });

    it('handles missing similarityScore on evidence items gracefully', () => {
      const axisEvidence = [
        makeAxisEvidence({
          observation_id: 'ae-no-score',
          similarity_score: undefined as unknown as number,
          evidence_type: 'quiz',
          text_excerpt: 'Evidence without score',
          source_action_title: 'Some Action',
        }),
      ];

      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({ axisOverrides: { axis_evidence: axisEvidence } }),
        ],
      });

      // Should render without crashing
      expect(screen.getByText('Evidence without score')).toBeInTheDocument();
      expect(screen.getByText('Quiz')).toBeInTheDocument();
      // No percentage badge should be shown
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('shows empty state when both axis_evidence and evidence are empty', () => {
      renderAxisDrilldown({
        capabilityProfiles: [
          makeCapabilityProfile({
            axisOverrides: {
              axis_evidence: [],
              evidence: [],
            },
          }),
        ],
      });

      expect(screen.getByText('No specific observations for this axis.')).toBeInTheDocument();
    });
  });
});
