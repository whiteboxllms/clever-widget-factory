import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnifiedActionDialog } from '../UnifiedActionDialog';
import { statesQueryKey } from '@/lib/queryKeys';
import type { BaseAction } from '@/types/actions';

// Mock dependencies
vi.mock('@/hooks/useCognitoAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    isLeadership: true,
  }),
}));

vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: () => 'test-org-id',
}));

vi.mock('@/hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadImages: vi.fn(),
    isUploading: false,
  }),
}));

vi.mock('@/lib/apiService', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getApiData: vi.fn((data) => data),
}));

describe('UnifiedActionDialog - Implementation Notes Validation', () => {
  let queryClient: QueryClient;
  const mockAction: BaseAction = {
    id: '56a33460-f436-4ab2-aecd-10cf0f30faf6',
    title: 'Test Action',
    description: 'Test description',
    policy: 'Test policy',
    status: 'in_progress',
    assigned_to: 'test-user-id',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    organization_id: 'test-org-id',
    plan_commitment: true,
    policy_agreed_at: '2025-01-01T00:00:00Z',
    policy_agreed_by: 'test-user-id',
    required_tools: [],
    required_stock: [],
    attachments: [],
    participants: [],
  };

  const mockProfiles = [
    {
      user_id: 'test-user-id',
      full_name: 'Test User',
      email: 'test@example.com',
      cognito_user_id: 'test-user-id',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('should allow marking action as Done when implementation notes exist in cache', async () => {
    const user = userEvent.setup();
    
    // Pre-populate cache with actions
    queryClient.setQueryData(['actions'], [mockAction]);
    
    // Pre-populate cache with states (implementation notes)
    const mockStates = [
      {
        id: 'state-1',
        state_text: 'Implementation note 1',
        captured_at: '2025-01-01T00:00:00Z',
        captured_by: 'test-user-id',
        organization_id: 'test-org-id',
      },
    ];
    queryClient.setQueryData(
      statesQueryKey({ entity_type: 'action', entity_id: mockAction.id }),
      mockStates
    );

    const onOpenChange = vi.fn();
    const onActionSaved = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedActionDialog
          open={true}
          onOpenChange={onOpenChange}
          actionId={mockAction.id}
          profiles={mockProfiles}
          onActionSaved={onActionSaved}
          isCreating={false}
        />
      </QueryClientProvider>
    );

    // Wait for dialog to render
    await waitFor(() => {
      expect(screen.getByText('Test Action')).toBeInTheDocument();
    });

    // Find and click the "Mark as Done" button
    const doneButton = screen.getByRole('button', { name: /mark as done|ready for review/i });
    expect(doneButton).toBeInTheDocument();
    expect(doneButton).not.toBeDisabled();

    // Click the button - should NOT show validation error
    await user.click(doneButton);

    // Should NOT show error toast about missing implementation notes
    await waitFor(() => {
      const errorToast = screen.queryByText(/please add at least one implementation update/i);
      expect(errorToast).not.toBeInTheDocument();
    });
  });

  it('should show validation error when no implementation notes exist', async () => {
    const user = userEvent.setup();
    
    // Pre-populate cache with actions
    queryClient.setQueryData(['actions'], [mockAction]);
    
    // Pre-populate cache with EMPTY states array (no implementation notes)
    queryClient.setQueryData(
      statesQueryKey({ entity_type: 'action', entity_id: mockAction.id }),
      []
    );

    const onOpenChange = vi.fn();
    const onActionSaved = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedActionDialog
          open={true}
          onOpenChange={onOpenChange}
          actionId={mockAction.id}
          profiles={mockProfiles}
          onActionSaved={onActionSaved}
          isCreating={false}
        />
      </QueryClientProvider>
    );

    // Wait for dialog to render
    await waitFor(() => {
      expect(screen.getByText('Test Action')).toBeInTheDocument();
    });

    // Find and click the "Mark as Done" button
    const doneButton = screen.getByRole('button', { name: /mark as done|ready for review/i });
    expect(doneButton).toBeInTheDocument();

    // Click the button - SHOULD show validation error
    await user.click(doneButton);

    // Should show error toast about missing implementation notes
    await waitFor(() => {
      const errorToast = screen.getByText(/please add at least one implementation update/i);
      expect(errorToast).toBeInTheDocument();
    });
  });

  it('should use cache-derived count instead of making API calls', async () => {
    const { apiService } = await import('@/lib/apiService');
    const mockGet = vi.mocked(apiService.get);
    
    // Pre-populate cache with actions
    queryClient.setQueryData(['actions'], [mockAction]);
    
    // Pre-populate cache with states
    const mockStates = [
      {
        id: 'state-1',
        state_text: 'Implementation note 1',
        captured_at: '2025-01-01T00:00:00Z',
        captured_by: 'test-user-id',
        organization_id: 'test-org-id',
      },
    ];
    queryClient.setQueryData(
      statesQueryKey({ entity_type: 'action', entity_id: mockAction.id }),
      mockStates
    );

    const onOpenChange = vi.fn();
    const onActionSaved = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <UnifiedActionDialog
          open={true}
          onOpenChange={onOpenChange}
          actionId={mockAction.id}
          profiles={mockProfiles}
          onActionSaved={onActionSaved}
          isCreating={false}
        />
      </QueryClientProvider>
    );

    // Wait for dialog to render
    await waitFor(() => {
      expect(screen.getByText('Test Action')).toBeInTheDocument();
    });

    // Verify that NO API calls were made to /action_implementation_updates
    expect(mockGet).not.toHaveBeenCalledWith(
      expect.stringContaining('/action_implementation_updates')
    );
    
    // The validation should work purely from cache
    const doneButton = screen.getByRole('button', { name: /mark as done|ready for review/i });
    expect(doneButton).not.toBeDisabled();
  });
});
