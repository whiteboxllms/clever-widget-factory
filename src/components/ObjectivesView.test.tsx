import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObjectivesView } from './ObjectivesView';
import type { LearningObjective } from '@/hooks/useLearning';

/** Helper to build a LearningObjective with sensible defaults */
function makeObjective(
  overrides: Partial<LearningObjective> & { id: string; text: string }
): LearningObjective {
  return {
    similarityScore: 0,
    matchedObjectiveText: null,
    priorLearning: [],
    status: 'not_started',
    completionType: null,
    ...overrides,
  };
}

describe('ObjectivesView', () => {
  const defaultProps = {
    axisLabel: 'Water Chemistry',
    onStartQuiz: vi.fn(),
  };

  describe('similarity threshold badges', () => {
    it('renders "Likely covered" badge for objectives with similarityScore >= 0.8', () => {
      const objectives = [
        makeObjective({
          id: 'obj-1',
          text: 'Understand water ratios',
          similarityScore: 0.85,
          matchedObjectiveText: 'Water chemistry ratios',
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.getByText('Likely covered')).toBeInTheDocument();
      // Should be in optional review section
      expect(screen.getByText('Optional review')).toBeInTheDocument();
    });

    it('renders "Related learning found" badge for objectives with 0.5 <= similarityScore < 0.8', () => {
      const objectives = [
        makeObjective({
          id: 'obj-2',
          text: 'Explain cement curing',
          similarityScore: 0.65,
          matchedObjectiveText: 'Cement hydration process',
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.getByText('Related learning found')).toBeInTheDocument();
      // Should be in required section
      expect(screen.getByText('Required objectives')).toBeInTheDocument();
    });

    it('renders "New material" badge for objectives with similarityScore < 0.5', () => {
      const objectives = [
        makeObjective({
          id: 'obj-3',
          text: 'Identify soil pH levels',
          similarityScore: 0.2,
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.getByText('New material')).toBeInTheDocument();
      expect(screen.getByText('Required objectives')).toBeInTheDocument();
    });

    it('treats missing similarityScore as new material', () => {
      const objectives = [
        makeObjective({
          id: 'obj-4',
          text: 'Handle null score',
          similarityScore: undefined as unknown as number,
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.getByText('New material')).toBeInTheDocument();
    });
  });

  describe('matched text display', () => {
    it('shows matched text for "Likely covered" objectives', () => {
      const objectives = [
        makeObjective({
          id: 'obj-lc',
          text: 'Understand water ratios',
          similarityScore: 0.9,
          matchedObjectiveText: 'Water chemistry ratios in concrete',
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(
        screen.getByText(/Closest match:.*Water chemistry ratios in concrete/)
      ).toBeInTheDocument();
    });

    it('shows matched text for "Related learning found" objectives', () => {
      const objectives = [
        makeObjective({
          id: 'obj-rl',
          text: 'Explain cement curing',
          similarityScore: 0.6,
          matchedObjectiveText: 'Cement hydration process',
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(
        screen.getByText(/Closest match:.*Cement hydration process/)
      ).toBeInTheDocument();
    });

    it('does not show matched text when matchedObjectiveText is null', () => {
      const objectives = [
        makeObjective({
          id: 'obj-null',
          text: 'No match available',
          similarityScore: 0.85,
          matchedObjectiveText: null,
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.queryByText(/Closest match/)).not.toBeInTheDocument();
    });
  });

  describe('expandable prior learning section', () => {
    it('shows prior learning matches when expanded', async () => {
      const user = userEvent.setup();
      const objectives = [
        makeObjective({
          id: 'obj-pl',
          text: 'Understand water ratios',
          similarityScore: 0.65,
          matchedObjectiveText: 'Water chemistry ratios',
          priorLearning: [
            { similarityScore: 0.87, sourceText: 'Water chemistry ratios in concrete mixing' },
            { similarityScore: 0.72, sourceText: 'Water content affects plaster setting' },
          ],
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      // Prior learning trigger should be visible
      const trigger = screen.getByText(/Show prior learning/);
      expect(trigger).toBeInTheDocument();

      // Content should not be visible initially
      expect(screen.queryByText(/Water chemistry ratios in concrete mixing/)).not.toBeInTheDocument();

      // Click to expand
      await user.click(trigger);

      // Now prior learning matches should be visible
      expect(screen.getByText(/Water chemistry ratios in concrete mixing/)).toBeInTheDocument();
      expect(screen.getByText(/Water content affects plaster setting/)).toBeInTheDocument();
      // Similarity scores displayed as percentages
      expect(screen.getByText(/87%/)).toBeInTheDocument();
      expect(screen.getByText(/72%/)).toBeInTheDocument();
    });

    it('does not show prior learning trigger when priorLearning is empty', () => {
      const objectives = [
        makeObjective({
          id: 'obj-empty-pl',
          text: 'No prior learning',
          similarityScore: 0.3,
          priorLearning: [],
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.queryByText(/Show prior learning/)).not.toBeInTheDocument();
    });

    it('does not show prior learning trigger when priorLearning is undefined', () => {
      const objectives = [
        makeObjective({
          id: 'obj-undef-pl',
          text: 'Undefined prior learning',
          similarityScore: 0.4,
          priorLearning: undefined as unknown as [],
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.queryByText(/Show prior learning/)).not.toBeInTheDocument();
    });
  });

  describe('objective grouping', () => {
    it('groups likely_covered objectives under optional review and others under required', () => {
      const objectives = [
        makeObjective({
          id: 'obj-new',
          text: 'Brand new topic',
          similarityScore: 0.1,
        }),
        makeObjective({
          id: 'obj-related',
          text: 'Related topic',
          similarityScore: 0.6,
        }),
        makeObjective({
          id: 'obj-covered',
          text: 'Already covered topic',
          similarityScore: 0.9,
          matchedObjectiveText: 'Previously learned topic',
        }),
      ];

      render(
        <ObjectivesView {...defaultProps} objectives={objectives} />
      );

      expect(screen.getByText('Required objectives')).toBeInTheDocument();
      expect(screen.getByText('Optional review')).toBeInTheDocument();
      // Required section has new + related
      expect(screen.getByText('Brand new topic')).toBeInTheDocument();
      expect(screen.getByText('Related topic')).toBeInTheDocument();
      // Optional section has covered
      expect(screen.getByText('Already covered topic')).toBeInTheDocument();
    });
  });
});
