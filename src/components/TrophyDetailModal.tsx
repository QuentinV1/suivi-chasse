import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Scale,
  Pencil,
  Trash2,
  Award,
  Share2,
  Navigation,
} from 'lucide-react';
import { GeoPoint, Trophy } from '../types';
import { formatCoords, formatDateFr } from '../constants/game';
import { ShareTrophyModal } from './ShareTrophyModal';

interface TrophyDetailModalProps {
  trophy: Trophy;
  onClose: () => void;
  onEdit: (trophy: Trophy) => void;
  onDelete: (id: string) => void;
  onViewOnMap?: (coords: GeoPoint) => void;
}

export const TrophyDetailModal: React.FC<TrophyDetailModalProps> = ({
  trophy,
  onClose,
  onEdit,
  onDelete,
  onViewOnMap,
}) => {
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isShareOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShareOpen, onClose]);

  const handleDelete = () => {
    if (window.confirm('Supprimer définitivement ce trophée de l’album ?')) {
      onDelete(trophy.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        {/* Image / Visual Header */}
        <div className="relative bg-forest-950">
          {trophy.photo ? (
            <img
              src={trophy.photo}
              alt={trophy.title || trophy.species}
              className="max-h-[46vh] w-full object-contain bg-forest-950"
            />
          ) : (
            <div className="flex h-44 w-full flex-col items-center justify-center bg-gradient-to-br from-forest-900 to-forest-950 text-earth-300">
              <Award className="h-12 w-12 opacity-70" />
              <span className="mt-2 text-xs uppercase tracking-widest text-earth-300/80">
                Sans photo
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div>
            <span className="inline-flex items-center rounded-full bg-copper-500/15 px-3 py-0.5 text-xs font-semibold text-copper-600">
              {trophy.species}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-forest-950">
              {trophy.title || trophy.species}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-earth-200 bg-earth-50/70 px-3 py-2.5 text-sm text-forest-950">
              <Calendar className="h-4 w-4 shrink-0 text-forest-700" />
              <span>{formatDateFr(trophy.date)}</span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-earth-200 bg-earth-50/70 px-3 py-2.5 text-sm text-forest-950">
              <Scale className="h-4 w-4 shrink-0 text-copper-600" />
              <span>
                {trophy.weightKg !== undefined ? `${trophy.weightKg} kg` : 'Poids non renseigné'}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-earth-200 bg-earth-50/70 px-3 py-2.5 text-sm text-forest-950">
              <MapPin className="h-4 w-4 shrink-0 text-earth-600" />
              <span className="truncate">{trophy.location || 'Lieu non renseigné'}</span>
            </div>
          </div>

          {trophy.description && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                Description &amp; mensurations
              </h3>
              <p className="whitespace-pre-wrap rounded-xl border border-earth-200 bg-earth-50/60 p-3.5 text-sm leading-relaxed text-forest-950">
                {trophy.description}
              </p>
            </div>
          )}

          {trophy.coordinates && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forest-200 bg-forest-50/60 px-3.5 py-2.5 text-xs text-forest-900">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-forest-700" />
                <span>
                  GPS : <strong>{formatCoords(trophy.coordinates.lat, trophy.coordinates.lng)}</strong>
                </span>
              </div>
              {onViewOnMap && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewOnMap(trophy.coordinates!);
                  }}
                  className="rounded-lg bg-forest-700 px-2.5 py-1 font-semibold text-white transition hover:bg-forest-800"
                >
                  Voir sur la carte
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-earth-200 bg-earth-50/60 px-4 py-3 sm:px-5 sm:py-3.5">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-copper-500/30 bg-copper-500/10 px-3.5 py-2 text-sm font-semibold text-copper-600 transition hover:bg-copper-500/20"
            >
              <Share2 className="h-4 w-4" />
              Partager
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 transition hover:bg-earth-100"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(trophy);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
          </div>
        </div>
      </div>

      {isShareOpen && (
        <ShareTrophyModal
          trophy={trophy}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
};
