import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ExplorationAssociationDialog } from '../../components/ExplorationAssociationDialog';
import * as explorationService from '../../services/explorationService';

// Mock the exploration service
vi.mock('../../services/explorationService', () => ({
  explorationService: {
    getNonIntegratedExplorations: vi.fn(),
    createNewExploration: vi.fn(),
    linkExploration: vi.fn(),
  },
}));

// Mock UI components
vi.mock('../../components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <span>Loading...</span>,
  Plus: () => <span>+</span>,
  AlertCircle: () => <span>!</span>,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('ExplorationAssociationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog when open', () => {
    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      []
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByText('Select or Create Exploration')).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={false}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('should display explorations list', async () => {
    const mockExplorations = [
      {
        id: 'exp-1',
        exploration_code: 'SF010326EX01',
        exploration_notes_text: 'Test exploration',
        status: 'in_progress',
        action_count: 2,
        created_at: '2026-01-18T10:00:00Z',
      },
    ];

    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      mockExplorations
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('SF010326EX01')).toBeInTheDocument();
      expect(screen.getByText('Test exploration')).toBeInTheDocument();
      expect(screen.getByText('2 actions')).toBeInTheDocument();
    });
  });

  it('should show empty state when no explorations', async () => {
    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      []
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('No active explorations available')).toBeInTheDocument();
    });
  });

  it('should allow selecting an exploration', async () => {
    const mockExplorations = [
      {
        id: 'exp-1',
        exploration_code: 'SF010326EX01',
        exploration_notes_text: 'Test',
        status: 'in_progress',
        action_count: 1,
        created_at: '2026-01-18T10:00:00Z',
      },
    ];

    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      mockExplorations
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('SF010326EX01')).toBeInTheDocument();
    });

    const explorationButton = screen.getByText('SF010326EX01').closest('button');
    fireEvent.click(explorationButton!);

    await waitFor(() => {
      expect(screen.getByText('✓ Exploration selected')).toBeInTheDocument();
    });
  });

  it('should create new exploration', async () => {
    const newExploration = {
      id: 'exp-new',
      exploration_code: 'SF010326EX99',
      status: 'in_progress',
      action_count: 0,
      created_at: '2026-01-18T10:00:00Z',
    };

    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newExploration]);

    vi.mocked(explorationService.explorationService.createNewExploration).mockResolvedValue(
      newExploration
    );

    const { rerender } = render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const createButton = screen.getByText('Create New Exploration').closest('button');
    fireEvent.click(createButton!);

    await waitFor(() => {
      expect(explorationService.explorationService.createNewExploration).toHaveBeenCalled();
    });
  });

  it('should link exploration on confirm', async () => {
    const mockExplorations = [
      {
        id: 'exp-1',
        exploration_code: 'SF010326EX01',
        exploration_notes_text: 'Test',
        status: 'in_progress',
        action_count: 1,
        created_at: '2026-01-18T10:00:00Z',
      },
    ];

    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      mockExplorations
    );

    vi.mocked(explorationService.explorationService.linkExploration).mockResolvedValue({
      action: { id: 'action-1', exploration_ids: ['exp-1'] },
      explorations: [{ id: 'exp-1', action_count: 1 }],
    });

    const onLinked = vi.fn();
    const onClose = vi.fn();

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={onClose}
        onLinked={onLinked}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('SF010326EX01')).toBeInTheDocument();
    });

    // Select exploration
    const explorationButton = screen.getByText('SF010326EX01').closest('button');
    fireEvent.click(explorationButton!);

    // Click link button
    const linkButton = screen.getByText('Link Exploration').closest('button');
    fireEvent.click(linkButton!);

    await waitFor(() => {
      expect(explorationService.explorationService.linkExploration).toHaveBeenCalledWith(
        'action-1',
        'exp-1'
      );
      expect(onLinked).toHaveBeenCalledWith('exp-1');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Network error');
    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockRejectedValue(
      error
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load explorations')).toBeInTheDocument();
    });
  });

  it('should disable link button when no exploration selected', async () => {
    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      []
    );

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const linkButton = screen.getByText('Link Exploration').closest('button');
    expect(linkButton).toBeDisabled();
  });

  it('should call onClose when cancel is clicked', async () => {
    vi.mocked(explorationService.explorationService.getNonIntegratedExplorations).mockResolvedValue(
      []
    );

    const onClose = vi.fn();

    render(
      <ExplorationAssociationDialog
        actionId="action-1"
        isOpen={true}
        onClose={onClose}
      />,
      { wrapper: createWrapper() }
    );

    const cancelButton = screen.getByText('Cancel').closest('button');
    fireEvent.click(cancelButton!);

    expect(onClose).toHaveBeenCalled();
  });
});
