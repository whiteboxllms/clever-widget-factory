import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Integration test to prevent regression of dialog closing during file uploads
 * 
 * Issue: Dialogs were closing immediately when users selected files for upload,
 * causing uploads to be interrupted and lost.
 * 
 * Root cause: Dialog onOpenChange handlers didn't check if uploads were in progress
 * 
 * Fix: All dialogs using FileAttachmentManager must:
 * 1. Track upload state via onUploadStateChange callback
 * 2. Block onOpenChange when isUploading || isSubmitting
 */

// Mock the file upload hook
vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadFiles: vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve([{ url: 'test.jpg' }]), 100))
    ),
    isUploading: false
  })
}));

describe('Dialog Upload Blocking', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
  });

  /**
   * Test pattern for all dialogs with FileAttachmentManager:
   * 
   * 1. Dialog must accept onUploadStateChange prop from FileAttachmentManager
   * 2. Dialog must track isUploadingFiles state
   * 3. Dialog onOpenChange must check: if (!open && (isUploadingFiles || isSubmitting)) return;
   */
  it('should have upload blocking pattern in all dialogs using FileAttachmentManager', async () => {
    // This is a static analysis test - check the source code
    const dialogsWithFileUpload = [
      'src/components/CombinedAssetDialog.tsx',
      'src/components/tools/forms/EditToolForm.tsx'
    ];

    const fs = await import('fs');
    const path = await import('path');

    for (const dialogPath of dialogsWithFileUpload) {
      const fullPath = path.resolve(process.cwd(), dialogPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check 1: Dialog tracks upload state
      expect(content).toContain('isUploadingFiles');
      expect(content).toContain('setIsUploadingFiles');

      // Check 2: FileAttachmentManager passes upload state
      expect(content).toContain('onUploadStateChange={setIsUploadingFiles}');

      // Check 3: Dialog blocks closing during upload
      expect(content).toMatch(/onOpenChange.*isUploadingFiles.*isSubmitting/s);
    }
  });

  it('FileAttachmentManager should notify parent of upload state changes', async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    const fileAttachmentPath = path.resolve(
      process.cwd(), 
      'src/components/shared/FileAttachmentManager.tsx'
    );
    const content = fs.readFileSync(fileAttachmentPath, 'utf-8');

    // Check that FileAttachmentManager has the callback prop
    expect(content).toContain('onUploadStateChange?:');
    
    // Check that it calls the callback when upload state changes
    expect(content).toContain('onUploadStateChange?.(isUploading)');
  });
});
