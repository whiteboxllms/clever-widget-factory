/**
 * Property Test: Conditional UI Display
 * 
 * Property 5: Conditional UI Display
 * Validates: Requirements 2.5, 6.3
 * 
 * Tests that exploration tabs and UI elements are only displayed when appropriate:
 * - Exploration tab only shows for actions with exploration records
 * - UI elements adapt correctly to exploration presence/absence
 * - Tab layout adjusts dynamically (2-column vs 3-column)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fc from 'fast-check';
import { UnifiedActionDialog } from '@/components/UnifiedActionDialog';
import { ExplorationService } from '@/services/explorationService';
import { BaseAction, Profile } from '@/types/actions';

// Mock the exploration service
vi.mock('@/services/explorationService');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));
vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({ user: { userId: 'test-user' }, isLeadership: false })
}));
vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: () => 'test-org'
}));

const MockedExplorationService = ExplorationService as vi.MockedClass<typeof ExplorationService>;

describe('Property Test: Conditional UI Display', () => {
  let queryClient: QueryClient;
  let mockExplorationService: any;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    vi.clearAllMocks();
    
    mockExplorationService = {
      getExplorationByActionId: vi.fn()
    };

    MockedExplorationService.mockImplementation(() => mockExplorationService);
  });

  const mockProfiles: Profile[] = [
    {
      id: '1',
      user_id: 'user-1',
      full_name: 'Test User',
      role: 'admin'
    }
  ];

  const renderActionDialog = (action: BaseAction, hasExploration: boolean) => {
    // Mock exploration service response
    if (hasExploration) {
      mockExplorationService.getExplorationByActionId.mockResolvedValue({
        id: 1,
        action_id: action.id,
        exploration_code: 'SF010124EX001',
        exploration_notes_text: 'Test notes',
        metrics_text: 'Test metrics',
        public_flag: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
    } else {
      mockExplorationService.getExplorationByActionId.mockResolvedValue(null);
    }

    // Add action to query cache
    queryClient.setQueryData(['actions'], [action]);

    return render(
      <QueryClientProvider client={queryClient}>
        <UnifiedActionDialog
          open={true}
          onOpenChange={() => {}}
          actionId={action.id}
          profiles={mockProfiles}
          onActionSaved={() => {}}
          isCreating={false}
        />
      </QueryClientProvider>
    );
  };

  // Arbitrary generators for test data
  const actionArbitrary = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ maxLength: 500 })),
    policy: fc.option(fc.string({ maxLength: 1000 })),
    status: fc.constantFrom('not_started', 'in_progress', 'completed'),
    created_at: fc.date().map(d => d.toISOString()),
    updated_at: fc.date().map(d => d.toISOString())
  }).map(data => ({
    ...data,
    description: data.description || undefined,
    policy: data.policy || undefined
  })) as fc.Arbitrary<BaseAction>;

  const explorationPresenceArbitrary = fc.boolean();

  it('Property 5: Exploration tab visibility depends on exploration data presence', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArbitrary,
        explorationPresenceArbitrary,
        async (action, hasExploration) => {
          renderActionDialog(action, hasExploration);

          // Wait for the dialog to load and exploration check to complete
          await waitFor(() => {
            expect(screen.getByText('Policy')).toBeInTheDocument();
            expect(screen.getByText('Implementation')).toBeInTheDocument();
          }, { timeout: 3000 });

          if (hasExploration) {
            // When exploration data exists, exploration tab should be visible
            await waitFor(() => {
              expect(screen.getByText('Exploration')).toBeInTheDocument();
            }, { timeout: 2000 });

            // Tab list should have 3 columns (grid-cols-3)
            const tabsList = screen.getByRole('tablist');
            expect(tabsList).toHaveClass('grid-cols-3');
          } else {
            // When no exploration data, exploration tab should not be visible
            expect(screen.queryByText('Exploration')).not.toBeInTheDocument();

            // Tab list should have 2 columns (grid-cols-2)
            const tabsList = screen.getByRole('tablist');
            expect(tabsList).toHaveClass('grid-cols-2');
          }

          // Policy and Implementation tabs should always be present
          expect(screen.getByText('Policy')).toBeInTheDocument();
          expect(screen.getByText('Implementation')).toBeInTheDocument();
        }
      ),
      { 
        numRuns: 50,
        timeout: 10000,
        verbose: true
      }
    );
  });

  it('Property 5: Tab layout adapts correctly to exploration presence', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArbitrary,
        async (action) => {
          // Test both scenarios for the same action
          const scenarios = [
            { hasExploration: true, expectedCols: 'grid-cols-3', expectedTabs: 3 },
            { hasExploration: false, expectedCols: 'grid-cols-2', expectedTabs: 2 }
          ];

          for (const scenario of scenarios) {
            queryClient.clear();
            
            renderActionDialog(action, scenario.hasExploration);

            await waitFor(() => {
              expect(screen.getByText('Policy')).toBeInTheDocument();
            }, { timeout: 3000 });

            // Check tab list layout
            const tabsList = screen.getByRole('tablist');
            expect(tabsList).toHaveClass(scenario.expectedCols);

            // Count visible tabs
            const tabs = screen.getAllByRole('tab');
            expect(tabs).toHaveLength(scenario.expectedTabs);

            // Verify exploration tab presence matches expectation
            const explorationTab = screen.queryByText('Exploration');
            if (scenario.hasExploration) {
              expect(explorationTab).toBeInTheDocument();
            } else {
              expect(explorationTab).not.toBeInTheDocument();
            }
          }
        }
      ),
      { 
        numRuns: 25,
        timeout: 15000,
        verbose: true
      }
    );
  });

  it('Property 5: Exploration service is called appropriately based on action state', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArbitrary,
        explorationPresenceArbitrary,
        async (action, hasExploration) => {
          renderActionDialog(action, hasExploration);

          // Wait for component to mount and make service call
          await waitFor(() => {
            expect(mockExplorationService.getExplorationByActionId).toHaveBeenCalledWith(action.id);
          }, { timeout: 3000 });

          // Service should be called exactly once per action
          expect(mockExplorationService.getExplorationByActionId).toHaveBeenCalledTimes(1);
        }
      ),
      { 
        numRuns: 30,
        timeout: 10000,
        verbose: true
      }
    );
  });

  it('Property 5: UI remains stable when exploration data changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArbitrary,
        async (action) => {
          // Start without exploration data
          renderActionDialog(action, false);

          await waitFor(() => {
            expect(screen.getByText('Policy')).toBeInTheDocument();
          });

          // Verify initial state (2 tabs)
          let tabsList = screen.getByRole('tablist');
          expect(tabsList).toHaveClass('grid-cols-2');
          expect(screen.queryByText('Exploration')).not.toBeInTheDocument();

          // Simulate exploration data being added (re-render with exploration)
          queryClient.clear();
          renderActionDialog(action, true);

          await waitFor(() => {
            expect(screen.getByText('Exploration')).toBeInTheDocument();
          }, { timeout: 3000 });

          // Verify updated state (3 tabs)
          tabsList = screen.getByRole('tablist');
          expect(tabsList).toHaveClass('grid-cols-3');

          // Core tabs should still be present
          expect(screen.getByText('Policy')).toBeInTheDocument();
          expect(screen.getByText('Implementation')).toBeInTheDocument();
        }
      ),
      { 
        numRuns: 20,
        timeout: 15000,
        verbose: true
      }
    );
  });

  it('Property 5: Error handling does not break conditional display', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArbitrary,
        async (action) => {
          // Mock service to throw error
          mockExplorationService.getExplorationByActionId.mockRejectedValue(
            new Error('Service unavailable')
          );

          renderActionDialog(action, false);

          await waitFor(() => {
            expect(screen.getByText('Policy')).toBeInTheDocument();
          });

          // Even with service error, UI should remain stable
          const tabsList = screen.getByRole('tablist');
          expect(tabsList).toHaveClass('grid-cols-2');
          expect(screen.queryByText('Exploration')).not.toBeInTheDocument();

          // Core functionality should not be affected
          expect(screen.getByText('Policy')).toBeInTheDocument();
          expect(screen.getByText('Implementation')).toBeInTheDocument();
        }
      ),
      { 
        numRuns: 20,
        timeout: 10000,
        verbose: true
      }
    );
  });
});