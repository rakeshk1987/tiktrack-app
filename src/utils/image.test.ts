import { describe, expect, it, vi, beforeEach } from 'vitest';
import { optimizeImage } from './image';

// Mock DOM APIs for Node environment
function createMockBlob(size: number): Blob {
  return new Blob([new ArrayBuffer(size)], { type: 'image/jpeg' });
}

describe('optimizeImage', () => {
  let mockCanvas: any;
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      drawImage: vi.fn()
    };

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      toBlob: vi.fn((callback: (blob: Blob | null) => void, type: string, quality: number) => {
        // Simulate compression: smaller blobs at lower quality
        const size = quality > 0.5 ? 300_000 : 100_000;
        callback(createMockBlob(size));
      })
    };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as any;
      return document.createElement(tag);
    });

    // Mock FileReader
    const MockFileReader = vi.fn().mockImplementation(() => ({
      readAsDataURL: vi.fn(function(this: any) {
        setTimeout(() => {
          this.onload({ target: { result: 'data:image/png;base64,abc' } });
        }, 0);
      }),
      onload: null as any,
      onerror: null as any
    }));
    vi.stubGlobal('FileReader', MockFileReader);

    // Mock Image
    const MockImage = vi.fn().mockImplementation(() => {
      const img = {
        width: 1200,
        height: 900,
        src: '',
        onload: null as any,
        onerror: null as any
      };
      // Trigger onload asynchronously when src is set
      Object.defineProperty(img, 'src', {
        set(val: string) {
          img._src = val;
          setTimeout(() => img.onload?.(), 0);
        },
        get() { return img._src || ''; }
      });
      return img;
    });
    vi.stubGlobal('Image', MockImage);
  });

  it('resizes images wider than 800px', async () => {
    const file = new File([new ArrayBuffer(500_000)], 'photo.png', { type: 'image/png' });
    const blob = await optimizeImage(file);
    
    // Canvas should have been resized
    expect(mockCanvas.width).toBe(800);
    expect(mockCanvas.height).toBe(600); // 900 * (800/1200)
    expect(blob).toBeInstanceOf(Blob);
  });

  it('iteratively compresses until under 0.2MB', async () => {
    const file = new File([new ArrayBuffer(500_000)], 'photo.png', { type: 'image/png' });
    await optimizeImage(file);
    
    // toBlob should be called multiple times (first at 0.8, then 0.65 which is under)
    expect(mockCanvas.toBlob).toHaveBeenCalledTimes(2);
  });

  it('throws if canvas context unavailable', async () => {
    mockCanvas.getContext = vi.fn(() => null);
    const file = new File([new ArrayBuffer(100)], 'photo.png', { type: 'image/png' });
    
    await expect(optimizeImage(file)).rejects.toThrow('Could not get canvas context');
  });
});
