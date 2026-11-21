import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Users,
  Eye,
  Crosshair,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { GeoPoint, Hunt } from '../types';
import { formatCoords, formatDateFr, getHuntingSeason } from '../constants/game';

interface HuntDetailModalProps {
  hunt: Hunt;
  onClose: () => void;
  onEdit: (hunt: Hunt) => void;
  onDelete: (id: string) => void;
  onViewOnMap?: (coords: GeoPoint) => void;
}

export const HuntDetailModal: React.FC<HuntDetailModalProps> = ({
  hunt,
  onClose,
  onEdit,
  onDelete,
  onViewOnMap,
}) => {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIdx !== null) {
          setLightboxIdx(null);
        } else {
          onClose();
        }
      } else if (lightboxIdx !== null && hunt.photos.length > 1) {
        if (e.key === 'ArrowLeft') {
          setLightboxIdx((lightboxIdx - 1 + hunt.photos.length) % hunt.photos.length);
        } else if (e.key === 'ArrowRight') {
          setLightboxIdx((lightboxIdx + 1) % hunt.photos.length);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIdx, hunt.photos.length, onClose]);

  const handleDelete = () => {
    if (window.confirm('Supprimer définitivement cette sortie de chasse ?')) {
      onDelete(hunt.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-earth-200 bg-forest-900 px-4 py-3.5 text-white sm:gap-4 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-copper-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                {hunt.huntType}
              </span>
              <span className="text-xs text-forest-200">
                Saison {getHuntingSeason(hunt.date)}
              </span>
            </div>
            <h2 className="mt-1.5 break-words text-xl font-semibold">{hunt.location}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-forest-200">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateFr(hunt.date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-forest-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {/* Participants */}
          {hunt.participants.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Users className="h-3.5 w-3.5" />
                Participants ({hunt.participants.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {hunt.participants.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-earth-200 bg-earth-100 px-3 py-1 text-xs font-medium text-earth-900"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Seen & Harvested */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-forest-200 bg-forest-50/60 p-3.5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-forest-800">
                <Eye className="h-3.5 w-3.5" />
                Gibier vu
              </h3>
              {hunt.seenGame.length === 0 ? (
                <p className="text-xs italic text-earth-600">Aucune observation enregistrée.</p>
              ) : (
                <ul className="space-y-1.5">
                  {hunt.seenGame.map((g, i) => (
                    <li
                      key={`${g.species}-${i}`}
                      className="flex items-center justify-between text-sm text-forest-950"
                    >
                      <span>{g.species}</span>
                      <span className="rounded-md bg-forest-200/70 px-2 py-0.5 text-xs font-bold text-forest-900">
                        ×{g.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-copper-500/25 bg-earth-50 p-3.5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-copper-600">
                <Crosshair className="h-3.5 w-3.5" />
                Gibier tué / prélevé
              </h3>
              {hunt.harvestedGame.length === 0 ? (
                <p className="text-xs italic text-earth-600">Aucun prélèvement.</p>
              ) : (
                <ul className="space-y-1.5">
                  {hunt.harvestedGame.map((g, i) => (
                    <li
                      key={`${g.species}-${i}`}
                      className="flex items-center justify-between text-sm text-forest-950"
                    >
                      <span>{g.species}</span>
                      <span className="rounded-md bg-copper-500/15 px-2 py-0.5 text-xs font-bold text-copper-600">
                        ×{g.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Notes */}
          {hunt.notes && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <MapPin className="h-3.5 w-3.5" />
                Notes &amp; récit
              </h3>
              <p className="whitespace-pre-wrap rounded-xl border border-earth-200 bg-earth-50/70 p-3.5 text-sm leading-relaxed text-forest-950">
                {hunt.notes}
              </p>
            </div>
          )}

          {/* GPS & Postes */}
          {(hunt.coordinates || (hunt.posts && hunt.posts.length > 0)) && (
            <div className="space-y-2 rounded-xl border border-forest-200 bg-forest-50/60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-forest-900">
                  <Navigation className="h-3.5 w-3.5 text-forest-700" />
                  Géolocalisation &amp; Postes
                </h3>
                {onViewOnMap && (hunt.coordinates || hunt.posts?.[0]) && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = hunt.coordinates ?? {
                        lat: hunt.posts![0].lat,
                        lng: hunt.posts![0].lng,
                      };
                      onClose();
                      onViewOnMap(target);
                    }}
                    className="rounded-lg bg-forest-700 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-forest-800"
                  >
                    Voir sur la carte
                  </button>
                )}
              </div>
              {hunt.coordinates && (
                <p className="text-xs text-forest-900">
                  Point principal : <strong>{formatCoords(hunt.coordinates.lat, hunt.coordinates.lng)}</strong>
                </p>
              )}
              {hunt.posts && hunt.posts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {hunt.posts.map((post) => (
                    <span
                      key={post.id}
                      className="rounded-lg border border-forest-200 bg-white px-2.5 py-1 text-xs text-forest-950"
                    >
                      <strong>{post.name}</strong>{' '}
                      <span className="text-earth-600">({formatCoords(post.lat, post.lng)})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {hunt.photos.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-earth-700">
                Photos ({hunt.photos.length})
              </h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {hunt.photos.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className="group aspect-[4/3] overflow-hidden rounded-xl border border-earth-200 bg-earth-100"
                  >
                    <img
                      src={src}
                      alt={`Sortie ${idx + 1}`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
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
              onClick={onClose}
              className="rounded-xl border border-earth-300 bg-white px-4 py-2 text-sm font-medium text-earth-800 transition hover:bg-earth-100"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(hunt);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-800"
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightboxIdx !== null && hunt.photos[lightboxIdx] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
            aria-label="Fermer la photo"
          >
            <X className="h-6 w-6" />
          </button>
          {hunt.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx(
                    (lightboxIdx - 1 + hunt.photos.length) % hunt.photos.length
                  );
                }}
                className="absolute left-2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:left-4"
                aria-label="Photo précédente"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((lightboxIdx + 1) % hunt.photos.length);
                }}
                className="absolute right-2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-4"
                aria-label="Photo suivante"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <img
            src={hunt.photos[lightboxIdx]}
            alt={`Agrandissement ${lightboxIdx + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
