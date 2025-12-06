/**
 * Tests for SimpleMissionForm UI terminology
 * 
 * BEFORE MIGRATION: Verifies "Mission" terminology is present
 * AFTER MIGRATION: Update to verify "Project" terminology
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleMissionForm } from '../SimpleMissionForm';
import { setupFetchMock, mockApiResponse } from '@/test-utils/mocks';
import { AuthWrapper } from '@/test-utils/testWrappers';

// Mock dependencies
vi.mock('@/lib/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

vi.mock('@/hooks/useImageUpload', () => ({
  useImageUpload: vi.fn(() => ({
    uploadToS3: vi.fn(),
  })),
}));

vi.mock('@/hooks/useOrganizationId', () => ({
  useOrganizationId: vi.fn(() => 'org-1'),
}));

vi.mock('@/hooks/useTempPhotoStorage', () => ({
  useTempPhotoStorage: vi.fn(() => ({
    addPhoto: vi.fn(),
    getPhotos: vi.fn(() => []),
    clearPhotos: vi.fn(),
  })),
}));

describe('SimpleMissionForm - UI Terminology', () => {
  const mockFormData = {
    title: '',
    problem_statement: '',
    qa_assigned_to: '',
    actions: [],
  };

  const mockSetFormData = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockProfiles: any[] = [];

  beforeEach(() => {
    setupFetchMock(() => mockApiResponse([]));
  });

  it('should display "Project Title" label', { timeout: 10000 }, () => {
    render(
      <AuthWrapper>
        <SimpleMissionForm
          formData={mockFormData}
          setFormData={mockSetFormData}
          profiles={mockProfiles}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </AuthWrapper>
    );

    // Should find "Project Title"
    const titleLabel = screen.getByText(/Project Title/i);
    expect(titleLabel).toBeInTheDocument();
  });

  it('should have "Enter project title" placeholder', { timeout: 10000 }, () => {
    render(
      <AuthWrapper>
        <SimpleMissionForm
          formData={mockFormData}
          setFormData={mockSetFormData}
          profiles={mockProfiles}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </AuthWrapper>
    );

    // Should find placeholder with "project"
    const input = screen.getByPlaceholderText(/Enter project title/i);
    expect(input).toBeInTheDocument();
  });

  it('should display "Create Project" button when not editing', { timeout: 10000 }, () => {
    render(
      <AuthWrapper>
        <SimpleMissionForm
          formData={mockFormData}
          setFormData={mockSetFormData}
          profiles={mockProfiles}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      </AuthWrapper>
    );

    // Should find "Create Project"
    const createButton = screen.getByText(/Create Project/i);
    expect(createButton).toBeInTheDocument();
  });

  it('should work correctly without a template', { timeout: 10000 }, () => {
    render(
      <AuthWrapper>
        <SimpleMissionForm
          formData={mockFormData}
          setFormData={mockSetFormData}
          profiles={mockProfiles}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          defaultTasks={[]}
        />
      </AuthWrapper>
    );

    // Should not show template header
    expect(screen.queryByText(/Custom Project/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Equipment Repair/i)).not.toBeInTheDocument();
    
    // Should show form fields
    expect(screen.getByText(/Project Title/i)).toBeInTheDocument();
    expect(screen.getByText(/Background/i)).toBeInTheDocument();
  });
});

