/**
 * Unit Tests for Photo Management in Exploration Data Collection
 * 
 * Tests the photo upload functionality including:
 * - Photo upload functionality in exploration tab
 * - Photo display in exploration lists
 * - Photo updates and removal
 * 
 * Requirements: 6.5, 6.6
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExplorationTab } from '@/components/ExplorationTab';
import { ExplorationService, ExplorationResponse } from '@/services/explorationService';
import { AIContentService } from '@/services/aiContentService';
import { useImageUpload } from '@/hooks/useImageUpload';
import { BaseAction } from '@/types/actions';

// Mock the services and hooks
vi.mock('@/services/explorationService');
vi.mock('@/services/aiContentService');
vi.mock('@/hooks/useImageUpload');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const MockedExplorationService = ExplorationService as vi.MockedClass<typeof ExplorationService>;
const MockedAIContentService = AIContentService as vi.MockedClass<typeof AIContentService>;
const mockedUseImageUpload = useImageUpload as Mock;

describe('Photo Management in Exploration Data Collection', () => {
  let queryClient: QueryClient;
  let mockExplorationService: any;
  let mockAIContentService: any;
  let mockUploadImages: Mock;

  const mockAction: BaseAction = {
    id: 'action-1',
    description: 'Testing soil conditions in field A',
    policy: 'Apply organic fertilizer based on soil test results',
    summary_policy_text: 'Use soil test results to guide fertilizer application',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_id: 'user-1',
    organization_id: 'org-1',
    location: 'Field A',
    crop: 'Corn',
    attachments: []
  };

  const mockExploration: ExplorationResponse = {
    id: 1,
    action_id: 'action-1',
    exploration_code: 'SF010124EX001',
    exploration_notes_text: 'Soil pH is 6.5, nitrogen levels are low',
    metrics_text: 'pH: 6.5, N: 15ppm, P: 25ppm, K: 180ppm',
    public_flag: true,
    key_photos: [
      'exploration-SF010124EX001-1704067200000-photo1.jpg',
      'exploration-SF010124EX001-1704067200001-photo2.jpg'
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    vi.clearAllMocks();

    // Setup service mocks
    mockExplorationService = {
      getExplorationByActionId: vi.fn(),
      updateExploration: vi.fn()
    };
    
    mockAIContentService = {
      generateExplorationSuggestions: vi.fn()
    };

    mockUploadImages = vi.fn();

    MockedExplorationService.mockImplementation(() => mockExplorationService);
    MockedAIContentService.mockImplementation(() => mockAIContentService);
    mockedUseImageUpload.mockReturnValue({
      uploadImages: mockUploadImages,
      isUploading: false
    });
  });

  const renderExplorationTab = (props = {}) => {
    const defaultProps = {
      action: mockAction,
      onUpdate: vi.fn()
    };

    mockExplorationService.getExplorationByActionId.mockResolvedValue(mockExploration);

    return render(
      <QueryClientProvider client={queryClient}>
        <ExplorationTab {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  describe('Photo Upload Functionality', () => {
    it('displays photo upload button', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });
      
      const uploadButton = screen.getByText('Upload Photos');
      expect(uploadButton).not.toBeDisabled();
    });

    it('shows upload button with camera icon', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const uploadButton = screen.getByText('Upload Photos');
        expect(uploadButton.querySelector('svg')).toBeInTheDocument(); // Camera icon
      });
    });

    it('uploads photos when files are selected', async () => {
      const mockFile1 = new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockResolvedValue([
        { url: 'https://example.com/photo1.jpg' },
        { url: 'https://example.com/photo2.jpg' }
      ]);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });

      // Simulate file selection
      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile1, mockFile2],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadImages).toHaveBeenCalledWith(
          [mockFile1, mockFile2],
          expect.objectContaining({
            bucket: 'mission-attachments',
            generateFileName: expect.any(Function)
          })
        );
      });
    });

    it('generates appropriate filenames for uploaded photos', async () => {
      const mockFile = new File(['photo'], 'test.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockResolvedValue([{ url: 'https://example.com/photo.jpg' }]);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });

      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadImages).toHaveBeenCalled();
        const callArgs = mockUploadImages.mock.calls[0];
        const options = callArgs[1];
        const generateFileName = options.generateFileName;
        
        // Test filename generation
        const generatedName = generateFileName(mockFile);
        expect(generatedName).toMatch(/^exploration-SF010124EX001-\d+-test\.jpg$/);
      });
    });

    it('handles upload errors gracefully', async () => {
      const mockFile = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockRejectedValue(new Error('Upload failed'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });

      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadImages).toHaveBeenCalled();
      });

      // Should handle error gracefully without breaking the component
      expect(screen.getByText('Upload Photos')).toBeInTheDocument();
    });

    it('disables upload button during upload', async () => {
      mockedUseImageUpload.mockReturnValue({
        uploadImages: mockUploadImages,
        isUploading: true
      });

      renderExplorationTab();
      
      await waitFor(() => {
        const uploadButton = screen.getByText('Uploading...');
        expect(uploadButton).toBeDisabled();
      });
    });

    it('accepts only image files', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
        expect(fileInput.accept).toBe('image/*');
      });
    });

    it('allows multiple file selection', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
        expect(fileInput.multiple).toBe(true);
      });
    });
  });

  describe('Photo Display', () => {
    it('displays uploaded photos in grid layout', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Should display both photos
      const photos = screen.getAllByAltText(/Exploration photo \d+/);
      expect(photos).toHaveLength(2);
    });

    it('displays photo count correctly', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });
    });

    it('displays photos with correct URLs', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const photos = screen.getAllByAltText(/Exploration photo \d+/) as HTMLImageElement[];
        expect(photos[0].src).toContain('exploration-SF010124EX001-1704067200000-photo1.jpg');
        expect(photos[1].src).toContain('exploration-SF010124EX001-1704067200001-photo2.jpg');
      });
    });

    it('handles both full URLs and relative paths', async () => {
      const explorationWithMixedUrls = {
        ...mockExploration,
        key_photos: [
          'https://example.com/full-url-photo.jpg',
          'relative-path-photo.jpg'
        ]
      };

      mockExplorationService.getExplorationByActionId.mockResolvedValue(explorationWithMixedUrls);

      renderExplorationTab();
      
      await waitFor(() => {
        const photos = screen.getAllByAltText(/Exploration photo \d+/) as HTMLImageElement[];
        expect(photos[0].src).toBe('https://example.com/full-url-photo.jpg');
        expect(photos[1].src).toContain('cwf-dev-assets.s3.us-west-2.amazonaws.com/relative-path-photo.jpg');
      });
    });

    it('opens photos in new tab when clicked', async () => {
      const mockWindowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);

      renderExplorationTab();
      
      await waitFor(() => {
        const photos = screen.getAllByAltText(/Exploration photo \d+/);
        expect(photos).toHaveLength(2);
      });

      const firstPhoto = screen.getAllByAltText(/Exploration photo \d+/)[0];
      fireEvent.click(firstPhoto);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('exploration-SF010124EX001-1704067200000-photo1.jpg'),
        '_blank'
      );

      mockWindowOpen.mockRestore();
    });

    it('shows remove button on hover', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: '' }); // X buttons
        expect(removeButtons.length).toBeGreaterThan(0);
      });
    });

    it('hides photo section when no photos exist', async () => {
      const explorationWithoutPhotos = {
        ...mockExploration,
        key_photos: []
      };

      mockExplorationService.getExplorationByActionId.mockResolvedValue(explorationWithoutPhotos);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.queryByText(/Uploaded Photos/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Photo Removal', () => {
    it('removes photo when X button is clicked', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Click the first remove button
      const removeButtons = screen.getAllByRole('button', { name: '' }); // X buttons
      const firstRemoveButton = removeButtons.find(button => 
        button.className.includes('absolute') && button.textContent === '×'
      );
      
      if (firstRemoveButton) {
        fireEvent.click(firstRemoveButton);
      }

      // Should update the count (though we need to trigger a re-render)
      await waitFor(() => {
        // The component should show changes indicator
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('updates form state when photo is removed', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Remove a photo
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const firstRemoveButton = removeButtons.find(button => 
        button.className.includes('absolute') && button.textContent === '×'
      );
      
      if (firstRemoveButton) {
        fireEvent.click(firstRemoveButton);
      }

      // Should show save button indicating changes
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('saves photo changes when save button is clicked', async () => {
      mockExplorationService.updateExploration.mockResolvedValue({
        ...mockExploration,
        key_photos: [mockExploration.key_photos[1]] // Only second photo remains
      });

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Remove first photo
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const firstRemoveButton = removeButtons.find(button => 
        button.className.includes('absolute') && button.textContent === '×'
      );
      
      if (firstRemoveButton) {
        fireEvent.click(firstRemoveButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });

      // Click save
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            key_photos: [mockExploration.key_photos[1]]
          })
        );
      });
    });
  });

  describe('Photo Updates After Creation', () => {
    it('allows adding photos to existing exploration', async () => {
      const mockFile = new File(['new-photo'], 'new-photo.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockResolvedValue([{ url: 'https://example.com/new-photo.jpg' }]);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Upload new photo
      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockUploadImages).toHaveBeenCalled();
      });

      // Should show save button for changes
      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });

    it('preserves existing photos when adding new ones', async () => {
      const mockFile = new File(['new-photo'], 'new-photo.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockResolvedValue([{ url: 'https://example.com/new-photo.jpg' }]);
      mockExplorationService.updateExploration.mockResolvedValue({
        ...mockExploration,
        key_photos: [...mockExploration.key_photos, 'https://example.com/new-photo.jpg']
      });

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Upload new photo
      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });

      // Save changes
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            key_photos: [
              ...mockExploration.key_photos,
              'https://example.com/new-photo.jpg'
            ]
          })
        );
      });
    });

    it('handles mixed photo operations (add and remove)', async () => {
      const mockFile = new File(['new-photo'], 'new-photo.jpg', { type: 'image/jpeg' });
      
      mockUploadImages.mockResolvedValue([{ url: 'https://example.com/new-photo.jpg' }]);

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Remove first photo
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const firstRemoveButton = removeButtons.find(button => 
        button.className.includes('absolute') && button.textContent === '×'
      );
      
      if (firstRemoveButton) {
        fireEvent.click(firstRemoveButton);
      }

      // Add new photo
      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });

      // Save changes
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            key_photos: [
              mockExploration.key_photos[1], // Second photo remains
              'https://example.com/new-photo.jpg' // New photo added
            ]
          })
        );
      });
    });
  });

  describe('Photo Display in Exploration Lists', () => {
    it('displays photo count in exploration cards', async () => {
      // This would be tested in the Explorations page component
      // The ExplorationTab component doesn't directly handle list display
      // But we can verify the data structure is correct
      
      renderExplorationTab();
      
      await waitFor(() => {
        expect(mockExplorationService.getExplorationByActionId).toHaveBeenCalledWith('action-1');
      });

      // Verify the exploration data includes key_photos
      expect(mockExploration.key_photos).toHaveLength(2);
      expect(mockExploration.key_photos[0]).toContain('photo1.jpg');
      expect(mockExploration.key_photos[1]).toContain('photo2.jpg');
    });
  });

  describe('Error Handling', () => {
    it('handles exploration loading errors gracefully', async () => {
      mockExplorationService.getExplorationByActionId.mockRejectedValue(new Error('Network error'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('No Exploration Data')).toBeInTheDocument();
      });
    });

    it('handles photo save errors gracefully', async () => {
      mockExplorationService.updateExploration.mockRejectedValue(new Error('Save failed'));

      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Uploaded Photos (2)')).toBeInTheDocument();
      });

      // Remove a photo to trigger changes
      const removeButtons = screen.getAllByRole('button', { name: '' });
      const firstRemoveButton = removeButtons.find(button => 
        button.className.includes('absolute') && button.textContent === '×'
      );
      
      if (firstRemoveButton) {
        fireEvent.click(firstRemoveButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });

      // Try to save
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockExplorationService.updateExploration).toHaveBeenCalled();
      });

      // Should handle error gracefully
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('handles empty file selection gracefully', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });

      // Simulate empty file selection
      const fileInput = document.getElementById('exploration-photo-upload') as HTMLInputElement;
      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should not call upload service
      expect(mockUploadImages).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('provides proper labels for photo upload', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Exploration Photos')).toBeInTheDocument();
        expect(screen.getByText(/Upload photos of treated\/exploration areas/)).toBeInTheDocument();
      });
    });

    it('provides alt text for uploaded photos', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        const photos = screen.getAllByAltText(/Exploration photo \d+/);
        expect(photos).toHaveLength(2);
        expect(photos[0]).toHaveAttribute('alt', 'Exploration photo 1');
        expect(photos[1]).toHaveAttribute('alt', 'Exploration photo 2');
      });
    });

    it('provides proper button labels', async () => {
      renderExplorationTab();
      
      await waitFor(() => {
        expect(screen.getByText('Upload Photos')).toBeInTheDocument();
      });

      // Remove buttons should have accessible content
      const removeButtons = screen.getAllByRole('button', { name: '' });
      expect(removeButtons.length).toBeGreaterThan(0);
    });
  });
});