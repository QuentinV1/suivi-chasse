/**
 * Compresses an image file client-side using Canvas to WebP (with JPEG fallback)
 * to keep local storage / IndexedDB fast and lightweight.
 */
export async function compressImage(
  file: File,
  maxDimension = 1280,
  quality = 0.78
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);
    const { width, height } = computeScaledSize(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxDimension
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Impossible d’initialiser le canvas pour compresser la photo.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const webpDataUrl = canvas.toDataURL('image/webp', quality);
    if (webpDataUrl.startsWith('data:image/webp')) {
      return webpDataUrl;
    }

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    img.src = src;
  });
}

function computeScaledSize(
  origWidth: number,
  origHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (origWidth <= maxDimension && origHeight <= maxDimension) {
    return { width: origWidth, height: origHeight };
  }
  const ratio = origWidth / origHeight;
  if (ratio >= 1) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension / ratio)),
    };
  }
  return {
    width: Math.max(1, Math.round(maxDimension * ratio)),
    height: maxDimension,
  };
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const base64Length = dataUrl.length - commaIdx - 1;
  return Math.floor((base64Length * 3) / 4);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}
