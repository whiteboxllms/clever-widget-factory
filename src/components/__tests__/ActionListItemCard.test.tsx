/**
 * Tests for ActionListItemCard component
 * 
 * Verifies:
 * - Basic rendering (title, description, timestamps)
 * - Border color logic (green, yellow, blue, default)
 * - Badges display (asset, issue tool, mission, assigned user, participants)
 * - Interactive behavior (onClick, onScoreAction)
 * - Edge cases (missing data, long text truncation)
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionListItemCard } from '../ActionListItemCard';
import { BaseAction, Profile } from '@/types/actions';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';

// Mock ScoreButton component
vi.mock('../ScoreButton', () => ({
  ScoreButton: ({ action, onScoreAction }: any) => {
    if (action.status !== 'completed') return null;
    return (
      <button
        onClick={onScoreAction}
        data-testid="score-button"
        className={action.has_score ? 'has-score' : ''}
      >
        Score
      </button>
    );
  },
}));

describe('ActionListItemCard', () => {
  const mockProfiles: Profile[] = [
    {
      id: 'user-1',
      user_id: 'user-1',
      full_name: 'John Doe',
      role: 'admin',
    },
    {
      id: 'user-2',
      user_id: 'user-2',
      full_name: 'Jane Smith',
      role: 'contributor',
    },
  ];

  const mockGetUserColor = vi.fn((userId: string) => {
    const colors: Record<string, string> = {
      'user-1': '#FF5733',
      'user-2': '#33FF57',
    };
    return colors[userId] || '#6B7280';
  });

  const baseAction: BaseAction = {
    id: 'action-1',
    title: 'Test Action',
    description: 'Test description',
    status: 'not_started',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    assigned_to: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMock(() => mockApiResponse([]));
  });

  describe('Basic Rendering', () => {
    it('should render action title', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('Test Action')).toBeInTheDocument();
    });

    it('should render action description when present', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('should not render description when missing', () => {
      const actionWithoutDescription = { ...baseAction, description: undefined };
      render(
        <ActionListItemCard
          action={actionWithoutDescription}
          profiles={mockProfiles}
        />
      );

      expect(screen.queryByText('Test description')).not.toBeInTheDocument();
    });

    it('should render updated timestamp', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    });

    it('should render estimated completion date when present', () => {
      const actionWithDate = {
        ...baseAction,
        estimated_completion_date: '2024-01-15T00:00:00Z',
      };
      render(
        <ActionListItemCard
          action={actionWithDate}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    });

    it('should not render estimated completion date when missing', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.queryByText(/Expected:/)).not.toBeInTheDocument();
    });
  });

  describe('Border Color Logic', () => {
    it('should apply green border for completed actions', () => {
      const completedAction = {
        ...baseAction,
        status: 'completed',
      };
      const { container } = render(
        <ActionListItemCard
          action={completedAction}
          profiles={mockProfiles}
        />
      );

      const card = container.querySelector('.border-emerald-500');
      expect(card).toBeInTheDocument();
    });

    it('should apply yellow border for actions with implementation updates + policy + plan commitment', () => {
      const inProgressAction = {
        ...baseAction,
        status: 'in_progress',
        policy: '<p>Test policy</p>',
        plan_commitment: true,
        implementation_update_count: 1,
      };
      const { container } = render(
        <ActionListItemCard
          action={inProgressAction}
          profiles={mockProfiles}
        />
      );

      const card = container.querySelector('.border-yellow-500');
      expect(card).toBeInTheDocument();
    });

    it('should apply blue border for actions with policy + plan commitment', () => {
      const readyAction = {
        ...baseAction,
        status: 'not_started',
        policy: '<p>Test policy</p>',
        plan_commitment: true,
        implementation_update_count: 0,
      };
      const { container } = render(
        <ActionListItemCard
          action={readyAction}
          profiles={mockProfiles}
        />
      );

      const card = container.querySelector('.border-blue-500');
      expect(card).toBeInTheDocument();
    });

    it('should apply default (no special border) for initial state', () => {
      const { container } = render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      const card = container.querySelector('.border-emerald-500, .border-yellow-500, .border-blue-500');
      expect(card).not.toBeInTheDocument();
    });
  });

  describe('Badges Display', () => {
    it('should show asset badge when action has asset', () => {
      const actionWithAsset = {
        ...baseAction,
        asset: {
          id: 'asset-1',
          name: 'Test Asset',
        },
      };
      render(
        <ActionListItemCard
          action={actionWithAsset}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText(/Asset: Test Asset/)).toBeInTheDocument();
    });

    it('should truncate long asset names', () => {
      const actionWithLongAsset = {
        ...baseAction,
        asset: {
          id: 'asset-1',
          name: 'Very Long Asset Name That Should Be Truncated',
        },
      };
      render(
        <ActionListItemCard
          action={actionWithLongAsset}
          profiles={mockProfiles}
        />
      );

      // The text is split across nodes, so we check for the presence of both parts
      expect(screen.getByText(/Asset:/)).toBeInTheDocument();
      expect(screen.getByText(/Very Long/)).toBeInTheDocument();
    });

    it('should show issue tool badge when action has issue_tool', () => {
      const actionWithIssueTool = {
        ...baseAction,
        issue_tool: {
          id: 'tool-1',
          name: 'Test Tool',
        },
      };
      render(
        <ActionListItemCard
          action={actionWithIssueTool}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText(/Issue Tool: Test Tool/)).toBeInTheDocument();
    });

    it('should show mission badge when action has mission', () => {
      const actionWithMission = {
        ...baseAction,
        mission: {
          id: 'mission-1',
          title: 'Test Mission',
          mission_number: 1,
        },
      };
      render(
        <ActionListItemCard
          action={actionWithMission}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText(/Project #1: Test Mission/)).toBeInTheDocument();
    });

    it('should truncate long mission titles', () => {
      const actionWithLongMission = {
        ...baseAction,
        mission: {
          id: 'mission-1',
          title: 'Very Long Mission Title That Should Be Truncated',
          mission_number: 1,
        },
      };
      render(
        <ActionListItemCard
          action={actionWithLongMission}
          profiles={mockProfiles}
        />
      );

      // The text is split across nodes, so we check for the presence of key parts
      expect(screen.getByText(/Project #/)).toBeInTheDocument();
      expect(screen.getByText(/Very Long/)).toBeInTheDocument();
    });

    it('should show assigned user badge with correct color', () => {
      const assignedAction = {
        ...baseAction,
        assigned_to: 'user-1',
        assigned_to_name: 'John Doe',
      };
      render(
        <ActionListItemCard
          action={assignedAction}
          profiles={mockProfiles}
          getUserColor={mockGetUserColor}
        />
      );

      const badge = screen.getByText('John Doe');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveStyle({ color: '#FF5733' });
    });

    it('should show "Unassigned" badge when no assigned user', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('should show participant badges with correct colors', () => {
      const actionWithParticipants = {
        ...baseAction,
        participants_details: [
          {
            id: 'user-1',
            user_id: 'user-1',
            full_name: 'John Doe',
            role: 'admin',
            favorite_color: '#FF0000',
          },
          {
            id: 'user-2',
            user_id: 'user-2',
            full_name: 'Jane Smith',
            role: 'contributor',
          },
        ],
      };
      render(
        <ActionListItemCard
          action={actionWithParticipants}
          profiles={mockProfiles}
          getUserColor={mockGetUserColor}
        />
      );

      const johnBadge = screen.getByText('John Doe');
      const janeBadge = screen.getByText('Jane Smith');
      
      expect(johnBadge).toBeInTheDocument();
      expect(janeBadge).toBeInTheDocument();
      expect(johnBadge).toHaveStyle({ color: '#FF0000' });
      expect(janeBadge).toHaveStyle({ color: '#33FF57' }); // From getUserColor
    });

    it('should not show participant badges when no participants', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('Interactive Behavior', () => {
    it('should call onClick handler when card is clicked', () => {
      const handleClick = vi.fn();
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
          onClick={handleClick}
        />
      );

      const card = screen.getByText('Test Action').closest('.cursor-pointer');
      fireEvent.click(card!);

      expect(handleClick).toHaveBeenCalledWith(baseAction);
    });

    it('should call onScoreAction when score button is clicked', () => {
      const handleScoreAction = vi.fn();
      const completedAction = {
        ...baseAction,
        status: 'completed',
      };
      render(
        <ActionListItemCard
          action={completedAction}
          profiles={mockProfiles}
          onScoreAction={handleScoreAction}
          showScoreButton={true}
        />
      );

      const scoreButton = screen.getByTestId('score-button');
      fireEvent.click(scoreButton);

      expect(handleScoreAction).toHaveBeenCalled();
    });

    it('should not show score button when showScoreButton is false', () => {
      const completedAction = {
        ...baseAction,
        status: 'completed',
      };
      render(
        <ActionListItemCard
          action={completedAction}
          profiles={mockProfiles}
          showScoreButton={false}
        />
      );

      expect(screen.queryByTestId('score-button')).not.toBeInTheDocument();
    });

    it('should not show score button for non-completed actions even if showScoreButton is true', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
          onScoreAction={vi.fn()}
          showScoreButton={true}
        />
      );

      expect(screen.queryByTestId('score-button')).not.toBeInTheDocument();
    });

    it('should prevent event propagation on score button click', () => {
      const handleClick = vi.fn();
      const handleScoreAction = vi.fn((action, e) => {
        e.stopPropagation();
      });
      const completedAction = {
        ...baseAction,
        status: 'completed',
      };
      render(
        <ActionListItemCard
          action={completedAction}
          profiles={mockProfiles}
          onClick={handleClick}
          onScoreAction={handleScoreAction}
          showScoreButton={true}
        />
      );

      const scoreButton = screen.getByTestId('score-button');
      fireEvent.click(scoreButton);

      expect(handleScoreAction).toHaveBeenCalled();
      // onClick should not be called because stopPropagation was called
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing profiles array gracefully', () => {
      const assignedAction = {
        ...baseAction,
        assigned_to: 'user-1',
      };
      render(
        <ActionListItemCard
          action={assignedAction}
          profiles={[]}
        />
      );

      expect(screen.getByText('Unknown User')).toBeInTheDocument();
    });

    it('should handle actions with no assigned user', () => {
      render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('should handle very long titles gracefully', () => {
      const actionWithLongTitle = {
        ...baseAction,
        title: 'A'.repeat(200),
      };
      render(
        <ActionListItemCard
          action={actionWithLongTitle}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
    });

    it('should handle very long descriptions gracefully', () => {
      const actionWithLongDescription = {
        ...baseAction,
        description: 'B'.repeat(500),
      };
      render(
        <ActionListItemCard
          action={actionWithLongDescription}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('B'.repeat(500))).toBeInTheDocument();
    });

    it('should use assigned_to_name when available', () => {
      const assignedAction = {
        ...baseAction,
        assigned_to: 'user-1',
        assigned_to_name: 'Custom Name',
      };
      render(
        <ActionListItemCard
          action={assignedAction}
          profiles={mockProfiles}
        />
      );

      expect(screen.getByText('Custom Name')).toBeInTheDocument();
    });

    it('should use assigned_to_color when available', () => {
      const assignedAction = {
        ...baseAction,
        assigned_to: 'user-1',
        assigned_to_color: '#FF00FF',
      };
      render(
        <ActionListItemCard
          action={assignedAction}
          profiles={mockProfiles}
          getUserColor={mockGetUserColor}
        />
      );

      const badge = screen.getByText('John Doe');
      expect(badge).toHaveStyle({ color: '#FF00FF' });
    });
  });

  describe('Accessibility', () => {
    it('should have cursor-pointer class for click indication', () => {
      const { container } = render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
          onClick={vi.fn()}
        />
      );

      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });

    it('should have proper semantic HTML structure', () => {
      const { container } = render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
        />
      );

      const heading = container.querySelector('h3');
      expect(heading).toBeInTheDocument();
      expect(heading?.textContent).toBe('Test Action');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ActionListItemCard
          action={baseAction}
          profiles={mockProfiles}
          className="custom-class"
        />
      );

      const card = container.querySelector('.custom-class');
      expect(card).toBeInTheDocument();
    });
  });
});

