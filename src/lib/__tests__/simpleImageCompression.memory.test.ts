import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImageSimple } from '../simpleImageCompression';

describe('Image Compression - Memory Cleanup', () => {
  let mockCanvas: any;
  let mockContext: any;
  let mockImage: any;
  let createElementSpy: any;

  beforeEach(() => {
    mockContext = {
      drawImage: vi.fn(),
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback) => {
        const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
        callback(blob);
      }),
    };

    mockImage = {
      src: '',
      width: 1920,
      height: 1080,
      onload: null as any,
      onerror: null as any,
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas;
      return document.createElement(tag);
    });

    global.Image = vi.fn(() => mockImage) as any;
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('should clean up canvas and image after successful compression', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const compressionPromise = compressImageSimple(mockFile);

    setTimeout(() => {
      if (mockImage.onload) mockImage.onload();
    }, 10);

    await compressionPromise;

    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
    expect(mockImage.src).toBe('');
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should clean up on image load error', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const compressionPromise = compressImageSimple(mockFile);

    setTimeout(() => {
      if (mockImage.onerror) mockImage.onerror();
    }, 10);

    await compressionPromise;

    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
    expect(mockImage.src).toBe('');
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should clean up on compression timeout', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const compressionPromise = compressImageSimple(mockFile);

    await new Promise(resolve => setTimeout(resolve, 15100));
    await compressionPromise;

    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
    expect(mockImage.src).toBe('');
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  }, 20000);

  it('should clean up on compression error', async () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    mockCanvas.toBlob = vi.fn(() => {
      throw new Error('Compression failed');
    });

    const compressionPromise = compressImageSimple(mockFile);

    setTimeout(() => {
      if (mockImage.onload) mockImage.onload();
    }, 10);

    await compressionPromise;

    expect(mockCanvas.width).toBe(0);
    expect(mockCanvas.height).toBe(0);
    expect(mockImage.src).toBe('');
  });
});
