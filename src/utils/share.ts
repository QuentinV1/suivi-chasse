import { Trophy } from '../types';
import { formatDateFr } from '../constants/game';

export function buildTrophyShareText(trophy: Trophy): string {
  const lines: string[] = [];
  const headline =
    trophy.title && trophy.title !== trophy.species
      ? `${trophy.title} (${trophy.species})`
      : trophy.species;

  lines.push(`🏆 Trophée : ${headline}`);
  lines.push(`📅 Date : ${formatDateFr(trophy.date)}`);

  if (trophy.weightKg !== undefined) {
    lines.push(`⚖️ Poids : ${trophy.weightKg} kg`);
  }
  if (trophy.location) {
    lines.push(`📍 Lieu : ${trophy.location}`);
  }
  if (trophy.description) {
    lines.push('');
    lines.push(trophy.description);
  }

  return lines.join('\n');
}

export async function dataUrlToFile(dataUrl: string, baseName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'trophee';
  return new File([blob], `${safeName}.${ext}`, { type: blob.type || 'image/jpeg' });
}

export function canUseNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function shareTrophyNative(
  trophy: Trophy,
  customText?: string
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (!canUseNativeShare()) {
    return 'unsupported';
  }

  const text = customText ?? buildTrophyShareText(trophy);
  const title = trophy.title || trophy.species;

  try {
    if (trophy.photo) {
      const file = await dataUrlToFile(trophy.photo, `${trophy.species}-${trophy.date}`);
      const shareDataWithFile: ShareData = {
        title,
        text,
        files: [file],
      };

      if (typeof navigator.canShare === 'function' && navigator.canShare(shareDataWithFile)) {
        await navigator.share(shareDataWithFile);
        return 'shared';
      }
    }

    await navigator.share({ title, text });
    return 'shared';
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function getSmsShareUrl(text: string): string {
  const isIos =
    typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIos ? '&' : '?';
  return `sms:${separator}body=${encodeURIComponent(text)}`;
}

export function downloadTrophyPhoto(trophy: Trophy): void {
  if (!trophy.photo) return;
  const mimeMatch = trophy.photo.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
  const mime = mimeMatch?.[1] ?? 'image/jpeg';
  const ext = mime === 'image/webp' ? 'webp' : mime === 'image/png' ? 'png' : 'jpg';
  const safeName = (trophy.title || trophy.species)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'trophee';

  const a = document.createElement('a');
  a.href = trophy.photo;
  a.download = `${safeName}-${trophy.date || 'photo'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
