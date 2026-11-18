import { HuntType } from '../types';

export const HUNT_TYPES: HuntType[] = [
  'Battue',
  'Approche',
  'Affût',
  'Petit gibier',
  "Chasse au chien d'arrêt",
  'Bécasse',
  "Gibier d'eau",
  'Autre',
];

export const COMMON_SPECIES: string[] = [
  'Sanglier',
  'Cerf',
  'Biche / Faon',
  'Chevreuil',
  'Renard',
  'Bécasse',
  'Faisan',
  'Perdrix',
  'Lièvre',
  'Lapin',
  'Pigeon ramier',
  'Canard colvert',
  'Mouflon',
  'Chamois',
  'Daim',
  'Blaireau',
  'Autre',
];

export const TROPHY_SPECIES: string[] = [
  'Sanglier',
  'Cerf',
  'Chevreuil',
  'Renard',
  'Bécasse',
  'Faisan',
  'Mouflon',
  'Chamois',
  'Lièvre',
  'Daim',
  'Autre',
];

/**
 * Computes French hunting season label from a YYYY-MM-DD date string.
 * A season runs from July 1st (year N) to June 30th (year N+1).
 */
export function getHuntingSeason(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  const [yearStr, monthStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return '';
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function formatDateFr(dateStr: string): string {
  if (!dateStr) return 'Date inconnue';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function formatShortDateFr(dateStr: string): string {
  if (!dateStr) return '';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
