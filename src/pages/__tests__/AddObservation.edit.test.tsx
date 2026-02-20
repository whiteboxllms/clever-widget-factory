import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, MemoryRouter } from 'react-router-dom';
import AddObservation from '../AddObservation';
import * as useStatesModule from '@/hooks/useStates';
import * as useFileUploadModule from '@/hooks/useFileUpload';
import type { Observation } from '@/types/observations';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock react-router-dom navigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the hooks
vi.mock('@/hooks/useStates');
vi.mock('@/hooks/useFileUpload');
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('AddObservation - Edit Mode', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/observations/edit/state-123']}>
        <Routes>
          <Route path="/observations/edit/:observationId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  describe('Edit Mode Detection', () => {
    it('should detect edit mode when observationId is present in URL', async () => {
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

      render(<AddObservation />, { wrapper });

      // Should show "Edit Observation" title
      await waitFor(() => {
        expect(screen.getByText('Edit Observation')).toBeInTheDocument();
      });

      // Should show "Update Observation" button
      expect(screen.getByRole('button', { name: /update observation/i })).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('should show loading state while fetching existing state', async () => {
      vi.spyOn(useStatesModule, 'useStateById').mockReturnValue({
        data: undefined,
        isLoading: true,
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

      render(<AddObservation />, { wrapper });

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByText('Loading observation...')).toBeInTheDocument();
      });
    });

    it('should pre-populate observation text from existing state', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'This is my test observation text',
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

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        const textarea = screen.getByLabelText('Details') as HTMLTextAreaElement;
        expect(textarea.value).toBe('This is my test observation text');
      });
    });

    it('should pre-populate captured_at timestamp from existing state', async () => {
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

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        const datetimeInput = screen.getByLabelText('Captured At') as HTMLInputElement;
        // datetime-local format is YYYY-MM-DDTHH:mm
        expect(datetimeInput.value).toBe('2024-01-15T10:30');
      });
    });

    it('should pre-populate photos from existing state', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [
          {
            id: 'photo-1',
            observation_id: 'state-123',
            photo_url: 'https://example.com/photo1.jpg',
            photo_description: 'First photo description',
            photo_order: 0,
          },
          {
            id: 'photo-2',
            observation_id: 'state-123',
            photo_url: 'https://example.com/photo2.jpg',
            photo_description: 'Second photo description',
            photo_order: 1,
          },
        ],
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

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        // Should display both photos
        const images = screen.getAllByRole('img');
        expect(images).toHaveLength(2);
        expect(images[0]).toHaveAttribute('src', 'https://example.com/photo1.jpg');
        expect(images[1]).toHaveAttribute('src', 'https://example.com/photo2.jpg');
      });

      // Check photo descriptions
      const textareas = screen.getAllByPlaceholderText(/Description for photo/);
      expect(textareas).toHaveLength(2);
      expect((textareas[0] as HTMLTextAreaElement).value).toBe('First photo description');
      expect((textareas[1] as HTMLTextAreaElement).value).toBe('Second photo description');
    });

    it('should handle empty observation_text gracefully', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: null,
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [
          {
            id: 'photo-1',
            observation_id: 'state-123',
            photo_url: 'https://example.com/photo1.jpg',
            photo_description: 'Photo with no text',
            photo_order: 0,
          },
        ],
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

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        const textarea = screen.getByLabelText('Details') as HTMLTextAreaElement;
        expect(textarea.value).toBe('');
      });
    });
  });

  describe('Save Functionality', () => {
    it('should call updateState when saving in edit mode', async () => {
      const user = userEvent.setup();
      const mockUpdateState = vi.fn().mockResolvedValue({});

      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Original text',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [],
        links: [{ id: 'link-1', observation_id: 'state-123', entity_type: 'tool', entity_id: 'tool-1' }],
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
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByLabelText('Details')).toBeInTheDocument();
      });

      // Modify the observation text
      const textarea = screen.getByLabelText('Details');
      await user.clear(textarea);
      await user.type(textarea, 'Updated observation text');

      // Click save button
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      // Verify updateState was called with correct parameters
      await waitFor(() => {
        expect(mockUpdateState).toHaveBeenCalledWith({
          id: 'state-123',
          data: expect.objectContaining({
            state_text: 'Updated observation text',
            captured_at: expect.any(String),
            photos: [],
            links: mockState.links,
          }),
        });
      });
    });

    it('should preserve existing links when updating', async () => {
      const user = userEvent.setup();
      const mockUpdateState = vi.fn().mockResolvedValue({});

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
        links: [
          { id: 'link-1', observation_id: 'state-123', entity_type: 'tool', entity_id: 'tool-1' },
          { id: 'link-2', observation_id: 'state-123', entity_type: 'action', entity_id: 'action-1' },
        ],
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
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Details')).toBeInTheDocument();
      });

      // Click save without making changes
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      // Verify links are preserved
      await waitFor(() => {
        expect(mockUpdateState).toHaveBeenCalledWith({
          id: 'state-123',
          data: expect.objectContaining({
            links: mockState.links,
          }),
        });
      });
    });

    it('should include updated photos when saving', async () => {
      const user = userEvent.setup();
      const mockUpdateState = vi.fn().mockResolvedValue({});

      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Test observation',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [
          {
            id: 'photo-1',
            observation_id: 'state-123',
            photo_url: 'https://example.com/photo1.jpg',
            photo_description: 'Original description',
            photo_order: 0,
          },
        ],
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
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Details')).toBeInTheDocument();
      });

      // Update photo description
      const photoDescriptionTextarea = screen.getByPlaceholderText('Description for photo 1');
      await user.clear(photoDescriptionTextarea);
      await user.type(photoDescriptionTextarea, 'Updated photo description');

      // Click save
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      // Verify photos are included with updated description
      await waitFor(() => {
        expect(mockUpdateState).toHaveBeenCalledWith({
          id: 'state-123',
          data: expect.objectContaining({
            photos: [
              {
                photo_url: 'https://example.com/photo1.jpg',
                photo_description: 'Updated photo description',
                photo_order: 0,
              },
            ],
          }),
        });
      });
    });

    it('should update captured_at timestamp when modified', async () => {
      const user = userEvent.setup();
      const mockUpdateState = vi.fn().mockResolvedValue({});

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
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Captured At')).toBeInTheDocument();
      });

      // Update captured_at
      const datetimeInput = screen.getByLabelText('Captured At');
      await user.clear(datetimeInput);
      await user.type(datetimeInput, '2024-01-20T14:45');

      // Click save
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      // Verify captured_at is updated (converted to ISO string)
      await waitFor(() => {
        expect(mockUpdateState).toHaveBeenCalledWith({
          id: 'state-123',
          data: expect.objectContaining({
            captured_at: expect.stringContaining('2024-01-20'),
          }),
        });
      });
    });

    it('should NOT call createState in edit mode', async () => {
      const user = userEvent.setup();
      const mockCreateState = vi.fn();
      const mockUpdateState = vi.fn().mockResolvedValue({});

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
        createState: mockCreateState,
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Details')).toBeInTheDocument();
      });

      // Click save
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      // Verify createState was NOT called
      await waitFor(() => {
        expect(mockCreateState).not.toHaveBeenCalled();
        expect(mockUpdateState).toHaveBeenCalled();
      });
    });
  });

  describe('Validation', () => {
    it('should allow saving with empty text if photos exist', async () => {
      const user = userEvent.setup();
      const mockUpdateState = vi.fn().mockResolvedValue({});

      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: 'Original text',
        captured_by: 'user-1',
        captured_by_name: 'Test User',
        captured_at: '2024-01-15T10:30:00Z',
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        photos: [
          {
            id: 'photo-1',
            observation_id: 'state-123',
            photo_url: 'https://example.com/photo1.jpg',
            photo_description: 'Test photo',
            photo_order: 0,
          },
        ],
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
        updateState: mockUpdateState,
        deleteState: vi.fn(),
        isCreating: false,
        isUpdating: false,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Details')).toBeInTheDocument();
      });

      // Clear observation text
      const textarea = screen.getByLabelText('Details');
      await user.clear(textarea);

      // Click save - should succeed because photo exists
      const saveButton = screen.getByRole('button', { name: /update observation/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateState).toHaveBeenCalledWith({
          id: 'state-123',
          data: expect.objectContaining({
            state_text: undefined, // Empty text becomes undefined
            photos: expect.arrayContaining([
              expect.objectContaining({
                photo_url: 'https://example.com/photo1.jpg',
              }),
            ]),
          }),
        });
      });
    });

    it('should disable save button when both text and photos are empty', async () => {
      const mockState: Observation = {
        id: 'state-123',
        organization_id: 'org-1',
        observation_text: '',
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

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /update observation/i });
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('Loading States', () => {
    it('should disable save button while updating', async () => {
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
        isUpdating: true, // Simulating update in progress
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /saving/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('should show "Saving..." text while updating', async () => {
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
        isUpdating: true,
        isDeleting: false,
      } as any);

      render(<AddObservation />, { wrapper });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
      });
    });
  });
});
