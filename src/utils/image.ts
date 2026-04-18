/**
 * TikTrack Image Optimization Utility
 * Enforces: max-width 800px, max-size 0.2MB
 */

const MAX_WIDTH = 800;
const MAX_SIZE_BYTES = 0.2 * 1024 * 1024; // 204,800 bytes

export async function optimizeImage(file: File): Promise<Blob> {
  // 1. Create Image object from file
  const img = await loadImage(file);

  // 2. Calculate new dimensions
  let { width, height } = img;
  if (width > MAX_WIDTH) {
    const ratio = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height = height * ratio;
  }

  // 3. Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0, width, height);

  // 4. Iterative compression
  let quality = 0.8;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > MAX_SIZE_BYTES && quality > 0.1) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, quality);
  }

  return blob;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File reader failed'));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      quality
    );
  });
}
