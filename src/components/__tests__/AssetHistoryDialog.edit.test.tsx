import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssetHistoryDialog } from '../AssetHistoryDialog';
import * as useToolHistoryModule from '@/hooks/tools/useToolHistory';
import * as useCognitoAuthModule from '@/hooks/useCognitoAuth';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock the hooks
vi.mock('@/hooks/tools/useToolHistory');
vi.mock('@/hooks/useCognitoAuth');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AssetHistoryDialog - Edit Button', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const mockObservation = {
    id: 'obs-123',
    observation_text: 'Test observation',
    observed_at: '2024-01-15T10:00:00Z',
    observed_by: 'user-123',
    observed_by_name: 'Test User',
    photos: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for useToolHistory
    vi.mocked(useToolHistoryModule.useToolHistory).mockReturnValue({
      toolHistory: [mockObservation],
      assetInfo: null,
      loading: false,
      fetchToolHistory: vi.fn(),
    });
  });

  const renderDialog = (user = { userId: 'user-123' }, isAdmin = false) => {
    vi.mocked(useCognitoAuthModule.useAuth).mockReturnValue({
      user,
      isAdmin,
      isAuthenticated: true,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
    } as any);

    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AssetHistoryDialog assetId="tool-1" assetName="Test Tool">
            <button>Open Dialog</button>
          </AssetHistoryDialog>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should show edit button when user is the observation creator', async () => {
    renderDialog({ userId: 'user-123' }, false);
    
    // Open the dialog
    const trigger = screen.getByText('Open Dialog');
    await userEvent.click(trigger);
    
    // Wait for the observation to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
    });
    
    // Check that edit button is present
    const editButton = screen.getByLabelText('Edit observation');
    expect(editButton).toBeInTheDocument();
  });

  it('should show edit button when user is an admin', async () => {
    renderDialog({ userId: 'different-user' }, true);
    
    // Open the dialog
    const trigger = screen.getByText('Open Dialog');
    await userEvent.click(trigger);
    
    // Wait for the observation to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
    });
    
    // Check that edit button is present
    const editButton = screen.getByLabelText('Edit observation');
    expect(editButton).toBeInTheDocument();
  });

  it('should NOT show edit button when user is neither creator nor admin', async () => {
    renderDialog({ userId: 'different-user' }, false);
    
    // Open the dialog
    const trigger = screen.getByText('Open Dialog');
    await userEvent.click(trigger);
    
    // Wait for the observation to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
    });
    
    // Check that edit button is NOT present
    const editButton = screen.queryByLabelText('Edit observation');
    expect(editButton).not.toBeInTheDocument();
  });

  it('should navigate to edit page when edit button is clicked', async () => {
    renderDialog({ userId: 'user-123' }, false);
    
    // Open the dialog
    const trigger = screen.getByText('Open Dialog');
    await userEvent.click(trigger);
    
    // Wait for the observation to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
    });
    
    // Click the edit button
    const editButton = screen.getByLabelText('Edit observation');
    await userEvent.click(editButton);
    
    // Verify navigation was called with correct path
    expect(mockNavigate).toHaveBeenCalledWith('/observations/edit/obs-123');
  });

  it('should show edit button for observation with photos', async () => {
    const observationWithPhotos = {
      ...mockObservation,
      photos: [
        {
          id: 'photo-1',
          photo_url: 'https://example.com/photo.jpg',
          photo_description: 'Test photo',
          photo_order: 0,
        },
      ],
    };

    vi.mocked(useToolHistoryModule.useToolHistory).mockReturnValue({
      toolHistory: [observationWithPhotos],
      assetInfo: null,
      loading: false,
      fetchToolHistory: vi.fn(),
    });

    renderDialog({ userId: 'user-123' }, false);
    
    // Open the dialog
    const trigger = screen.getByText('Open Dialog');
    await userEvent.click(trigger);
    
    // Wait for the observation to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test observation')).toBeInTheDocument();
    });
    
    // Check that edit button is present
    const editButton = screen.getByLabelText('Edit observation');
    expect(editButton).toBeInTheDocument();
  });
});
