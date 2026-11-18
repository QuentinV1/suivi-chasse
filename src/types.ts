export type HuntType =
  | 'Battue'
  | 'Approche'
  | 'Affût'
  | 'Petit gibier'
  | "Chasse au chien d'arrêt"
  | 'Bécasse'
  | 'Gibier d\'eau'
  | 'Autre';

export interface GameSpeciesCount {
  species: string;
  count: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  label?: string;
}

export interface HuntPost {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
}

export interface Hunt {
  id: string;
  date: string; // YYYY-MM-DD
  location: string;
  huntType: HuntType;
  participants: string[];
  seenGame: GameSpeciesCount[];
  harvestedGame: GameSpeciesCount[];
  notes: string;
  photos: string[]; // Compressed WebP/JPEG data URLs
  coordinates?: GeoPoint;
  posts?: HuntPost[];
  createdAt: string;
  updatedAt: string;
}

export interface Trophy {
  id: string;
  title: string;
  species: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  location: string;
  description: string;
  photo?: string; // Compressed WebP/JPEG data URL
  coordinates?: GeoPoint;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  hunts: Hunt[];
  trophies: Trophy[];
}

export type ActiveTab = 'hunts' | 'trophies' | 'stats' | 'map';
