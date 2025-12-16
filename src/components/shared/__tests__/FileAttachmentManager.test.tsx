import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { FileAttachmentManager } from '../FileAttachmentManager';

vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    uploadFiles: vi.fn().mockResolvedValue([{ url: 'https://example.com/test.jpg' }]),
    isUploading: false
  })
}));

describe('FileAttachmentManager', () => {
  it('should call onUploadStateChange when upload state changes', async () => {
    const onUploadStateChange = vi.fn();
    const onAttachmentsChange = vi.fn();

    render(
      <FileAttachmentManager
        attachments={[]}
        onAttachmentsChange={onAttachmentsChange}
        bucket="test-bucket"
        onUploadStateChange={onUploadStateChange}
      />
    );

    await waitFor(() => {
      expect(onUploadStateChange).toHaveBeenCalledWith(false);
    });
  });

  it('should accept onUploadStateChange as optional prop', () => {
    expect(() => {
      render(
        <FileAttachmentManager
          attachments={[]}
          onAttachmentsChange={vi.fn()}
          bucket="test-bucket"
        />
      );
    }).not.toThrow();
  });
});
