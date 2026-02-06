import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatesInline } from '../StatesInline';
import * as useStatesModule from '@/hooks/useStates';

// Mock the hooks
vi.mock('@/hooks/useStates');
vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadFiles: vi.fn(),
    isUploading: false
  })
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('StatesInline', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('renders loading state', () => {
    vi.spyOn(useStatesModule, 'useStates').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
      createState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any);

    render(
      <StatesInline entity_type="action" entity_id="test-id" />,
      { wrapper }
    );

    // Check for the loading spinner by class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders empty state when no observations', async () => {
    vi.spyOn(useStatesModule, 'useStates').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
      createState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any);

    render(
      <StatesInline entity_type="action" entity_id="test-id" />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('No observations yet')).toBeInTheDocument();
    });
  });

  it('renders add observation button', async () => {
    vi.spyOn(useStatesModule, 'useStates').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
      createState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any);

    render(
      <StatesInline entity_type="action" entity_id="test-id" />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Add Observation')).toBeInTheDocument();
    });
  });

  it('renders states list when data is available', async () => {
    const mockStates = [
      {
        id: 'state-1',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        observed_by: 'user-1',
        observed_by_name: 'Test User',
        observed_at: '2025-02-05T10:00:00Z',
        created_at: '2025-02-05T10:00:00Z',
        updated_at: '2025-02-05T10:00:00Z',
        photos: [],
        links: []
      }
    ];

    vi.spyOn(useStatesModule, 'useStates').mockReturnValue({
      data: mockStates,
      isLoading: false,
      error: null,
    } as any);

    vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
      createState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any);

    render(
      <StatesInline entity_type="action" entity_id="test-id" />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
      expect(screen.getByText(/Test User/)).toBeInTheDocument();
    });
  });

  it('renders error state', async () => {
    vi.spyOn(useStatesModule, 'useStates').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as any);

    vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
      createState: vi.fn(),
      updateState: vi.fn(),
      deleteState: vi.fn(),
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    } as any);

    render(
      <StatesInline entity_type="action" entity_id="test-id" />,
      { wrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load observations')).toBeInTheDocument();
    });
  });
});
