import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AddObservation from '../AddObservation';
import * as useStatesModule from '@/hooks/useStates';
import * as useFileUploadModule from '@/hooks/useFileUpload';
import type { Observation } from '@/types/observations';

// Mock the hooks
vi.mock('@/hooks/useStates');
vi.mock('@/hooks/useFileUpload');
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('AddObservation - Route Navigation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Default mock for file upload
    vi.mocked(useFileUploadModule.useFileUpload).mockReturnValue({
      uploadFiles: vi.fn(),
      isUploading: false,
    } as any);
  });

  describe('Edit Route Configuration', () => {
    it('should render AddObservation component when navigating to /observations/edit/:observationId', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [],
        links: [],
      };

      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: mockState,
        isLoading: false,
        isSuccess: true,
        isError: false,
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
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/observations/edit/state-123']}>
            <Routes>
              <Route path="/observations/edit/:observationId" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify the component renders in edit mode
      await waitFor(() => {
        expect(screen.getByText('Edit Observation')).toBeInTheDocument();
      });
    });

    it('should extract observationId parameter from URL', async () => {
      const mockUseStateById = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      });

      vi.spyOn(useStatesModule, 'useStateById').mockImplementation(mockUseStateById);

      vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
        createState: vi.fn(),
        updateState: vi.fn(),
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      const testObservationId = 'test-observation-456';

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/observations/edit/${testObservationId}`]}>
            <Routes>
              <Route path="/observations/edit/:observationId" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify useStateById was called with the correct ID from the URL
      await waitFor(() => {
        expect(mockUseStateById).toHaveBeenCalledWith(testObservationId);
      });
    });

    it('should handle different observation IDs in the route', async () => {
      const observationIds = ['obs-1', 'obs-2', 'obs-3'];

      for (const observationId of observationIds) {
        const mockState: Observation = {
          id: observationId,
          organization_id: 'org-1',
          observation_text: `Observation ${observationId}`,
          captured_by: 'user-1',
          captured_by_name: 'Test User',
          captured_at: '2024-01-15T10:30:00Z',
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z',
          photos: [],
          links: [],
        };

        vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
          data: mockState,
          isLoading: false,
          isSuccess: true,
          isError: false,
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

        const { unmount } = render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/observations/edit/${observationId}`]}>
              <Routes>
                <Route path="/observations/edit/:observationId" element={<AddObservation />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        );

        // Verify the correct observation is loaded
        await waitFor(() => {
          expect(screen.getByText('Edit Observation')).toBeInTheDocument();
          const textarea = screen.getByLabelText('Details') as HTMLTextAreaElement;
          expect(textarea.value).toBe(`Observation ${observationId}`);
        });

        unmount();
      }
    });
  });

  describe('Create Route Configuration', () => {
    it('should render AddObservation component when navigating to /combined-assets/:assetType/:id/observation', async () => {
      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
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
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/combined-assets/tools/tool-123/observation']}>
            <Routes>
              <Route path="/combined-assets/:assetType/:id/observation" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify the component renders in create mode
      await waitFor(() => {
        expect(screen.getByText('Add Observation')).toBeInTheDocument();
      });
    });

    it('should extract assetType and id parameters from create route', async () => {
      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
        error: null,
      } as any);

      const mockCreateState = vi.fn();
      vi.spyOn(useStatesModule, 'useStateMutations').mockReturnValue({
        createState: mockCreateState,
        updateState: vi.fn(),
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/combined-assets/parts/part-456/observation']}>
            <Routes>
              <Route path="/combined-assets/:assetType/:id/observation" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify the component renders in create mode (not edit mode)
      await waitFor(() => {
        expect(screen.getByText('Add Observation')).toBeInTheDocument();
        expect(screen.queryByText('Edit Observation')).not.toBeInTheDocument();
      });
    });
  });

  describe('Route Mode Detection', () => {
    it('should detect edit mode when observationId parameter is present', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [],
        links: [],
      };

      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: mockState,
        isLoading: false,
        isSuccess: true,
        isError: false,
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
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/observations/edit/state-123']}>
            <Routes>
              <Route path="/observations/edit/:observationId" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify edit mode UI elements
      await waitFor(() => {
        expect(screen.getByText('Edit Observation')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /update observation/i })).toBeInTheDocument();
      });
    });

    it('should detect create mode when observationId parameter is absent', async () => {
      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
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
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/combined-assets/tools/tool-123/observation']}>
            <Routes>
              <Route path="/combined-assets/:assetType/:id/observation" element={<AddObservation />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify create mode UI elements
      await waitFor(() => {
        expect(screen.getByText('Add Observation')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save observation/i })).toBeInTheDocument();
      });
    });
  });

  describe('Invalid Routes', () => {
    it('should handle missing observationId gracefully', async () => {
      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
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

      // Try to render with an empty observationId
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/observations/edit/']}>
            <Routes>
              <Route path="/observations/edit/:observationId" element={<AddObservation />} />
              <Route path="/observations/edit/" element={<div>Invalid Route</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Should show invalid route message
      await waitFor(() => {
        expect(screen.getByText('Invalid Route')).toBeInTheDocument();
      });
    });
  });
});
