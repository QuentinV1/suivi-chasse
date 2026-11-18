import React, { useEffect, useState } from 'react';
import { X, Camera, Plus, Trash2, Users, MapPin, Calendar, Loader2, Navigation } from 'lucide-react';
import { GameSpeciesCount, GeoPoint, Hunt, HuntPost, HuntType } from '../types';
import { HUNT_TYPES, formatCoords, generateId, getLocalTodayDate } from '../constants/game';
import { compressImage, estimateDataUrlBytes, formatBytes } from '../utils/image';
import { SpeciesListEditor } from './SpeciesListEditor';
import { GpsPickerField } from './GpsPickerField';

interface HuntFormModalProps {
  initialHunt?: Hunt | null;
  initialCoords?: GeoPoint | null;
  onSave: (hunt: Hunt) => Promise<void>;
  onClose: () => void;
}

export const HuntFormModal: React.FC<HuntFormModalProps> = ({
  initialHunt,
  initialCoords,
  onSave,
  onClose,
}) => {
  const today = getLocalTodayDate();

  const [date, setDate] = useState<string>(initialHunt?.date ?? today);
  const [location, setLocation] = useState<string>(initialHunt?.location ?? '');
  const [huntType, setHuntType] = useState<HuntType>(initialHunt?.huntType ?? 'Battue');
  const [participants, setParticipants] = useState<string[]>(initialHunt?.participants ?? []);
  const [participantInput, setParticipantInput] = useState<string>('');
  const [seenGame, setSeenGame] = useState<GameSpeciesCount[]>(initialHunt?.seenGame ?? []);
  const [harvestedGame, setHarvestedGame] = useState<GameSpeciesCount[]>(
    initialHunt?.harvestedGame ?? []
  );
  const [notes, setNotes] = useState<string>(initialHunt?.notes ?? '');
  const [photos, setPhotos] = useState<string[]>(initialHunt?.photos ?? []);
  const [coordinates, setCoordinates] = useState<GeoPoint | undefined>(
    initialHunt?.coordinates ?? initialCoords ?? undefined
  );
  const [posts, setPosts] = useState<HuntPost[]>(initialHunt?.posts ?? []);
  const [postNameInput, setPostNameInput] = useState('');
  const [isLocatingPost, setIsLocatingPost] = useState(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddParticipant = () => {
    const name = participantInput.trim();
    if (!name) return;
    if (!participants.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setParticipants([...participants, name]);
    }
    setParticipantInput('');
  };

  const handleParticipantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddParticipant();
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    setError(null);
    try {
      const compressedList = await Promise.all(
        Array.from(files).map((file) => compressImage(file, 1280, 0.78))
      );
      setPhotos((prev) => [...prev, ...compressedList]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de la compression des photos.'
      );
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      setError('Veuillez indiquer un lieu ou territoire.');
      return;
    }
    if (!date) {
      setError('Veuillez sélectionner une date.');
      return;
    }

    setIsSaving(true);
    setError(null);
    const now = new Date().toISOString();

    const hunt: Hunt = {
      id: initialHunt?.id ?? generateId('hunt'),
      date,
      location: location.trim(),
      huntType,
      participants,
      seenGame,
      harvestedGame,
      notes: notes.trim(),
      photos,
      coordinates,
      posts: posts.length > 0 ? posts : undefined,
      createdAt: initialHunt?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await onSave(hunt);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer la sortie.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-earth-200 bg-forest-900 px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-semibold">
              {initialHunt ? 'Modifier la sortie de chasse' : 'Nouvelle sortie de chasse'}
            </h2>
            <p className="text-xs text-forest-200">
              Enregistrez vos observations, prélèvements et souvenirs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-forest-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Date, Type, Lieu */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Calendar className="h-3.5 w-3.5" />
                Date
              </label>
              <input
                type="date"
                value={date}
                max="2099-12-31"
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
                Type de chasse
              </label>
              <select
                value={huntType}
                onChange={(e) => setHuntType(e.target.value as HuntType)}
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                {HUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <MapPin className="h-3.5 w-3.5" />
                Lieu / Territoire
              </label>
              <input
                type="text"
                value={location}
                maxLength={120}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex : Forêt de Tronçais, ACCA Saint-Martin..."
                required
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
          </div>

          {/* Géolocalisation & Postes */}
          <div className="space-y-3">
            <GpsPickerField
              value={coordinates}
              onChange={setCoordinates}
              label="Position GPS du territoire / rendez-vous"
            />

            <div className="rounded-xl border border-earth-200 bg-earth-50/50 p-3.5">
              <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Navigation className="h-3.5 w-3.5 text-copper-600" />
                Postes / Miradors / Points GPS ({posts.length})
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={postNameInput}
                  maxLength={60}
                  onChange={(e) => setPostNameInput(e.target.value)}
                  placeholder="Nom du poste (ex: Mirador Chêne, Poste 4)"
                  className="flex-1 min-w-[180px] rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-xs text-forest-950 focus:border-forest-600 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isLocatingPost || !postNameInput.trim()}
                  onClick={() => {
                    const name = postNameInput.trim();
                    if (!name) return;
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                      setIsLocatingPost(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setPosts((prev) => [
                            ...prev,
                            {
                              id: generateId('post'),
                              name,
                              lat: Number(pos.coords.latitude.toFixed(6)),
                              lng: Number(pos.coords.longitude.toFixed(6)),
                            },
                          ]);
                          setPostNameInput('');
                          setIsLocatingPost(false);
                        },
                        () => {
                          setIsLocatingPost(false);
                          if (coordinates) {
                            setPosts((prev) => [
                              ...prev,
                              {
                                id: generateId('post'),
                                name,
                                lat: coordinates.lat,
                                lng: coordinates.lng,
                              },
                            ]);
                            setPostNameInput('');
                          } else {
                            setError('GPS indisponible pour ce poste. Renseignez d’abord la position de la sortie.');
                          }
                        },
                        { enableHighAccuracy: true, timeout: 10000 }
                      );
                    } else if (coordinates) {
                      setPosts((prev) => [
                        ...prev,
                        { id: generateId('post'), name, lat: coordinates.lat, lng: coordinates.lng },
                      ]);
                      setPostNameInput('');
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-copper-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-copper-500 disabled:opacity-50"
                >
                  {isLocatingPost ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Ajouter poste GPS
                </button>
              </div>
              {posts.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {posts.map((post) => (
                    <span
                      key={post.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-earth-300 bg-white px-2.5 py-1 text-[11px] font-medium text-forest-950"
                    >
                      <span>{post.name}</span>
                      <span className="text-earth-500">({formatCoords(post.lat, post.lng)})</span>
                      <button
                        type="button"
                        onClick={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
                        className="rounded-full p-0.5 text-earth-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Supprimer ${post.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
              <Users className="h-3.5 w-3.5" />
              Participants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={participantInput}
                onChange={(e) => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKeyDown}
                placeholder="Prénom ou surnom (Entrée pour ajouter)"
                className="flex-1 rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
              <button
                type="button"
                onClick={handleAddParticipant}
                className="inline-flex items-center gap-1 rounded-xl border border-earth-300 bg-earth-100 px-3 py-2 text-sm font-medium text-forest-900 transition hover:bg-earth-200"
              >
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            </div>
            {participants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {participants.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-full border border-earth-300 bg-earth-100 px-2.5 py-0.5 text-xs font-medium text-earth-900"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => setParticipants(participants.filter((x) => x !== p))}
                      className="rounded-full p-0.5 hover:bg-earth-300/60"
                      aria-label={`Retirer ${p}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Gibier vu & Gibier prélevé */}
          <div className="grid grid-cols-1 gap-4">
            <SpeciesListEditor
              label="Gibier vu (observations)"
              items={seenGame}
              onChange={setSeenGame}
              accent="forest"
              emptyText="Aucun gibier observé renseigné."
            />

            <SpeciesListEditor
              label="Gibier tué / prélevé"
              items={harvestedGame}
              onChange={setHarvestedGame}
              accent="copper"
              emptyText="Aucun prélèvement renseigné."
            />
          </div>

          {/* Photos */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Camera className="h-3.5 w-3.5" />
                Photos de la sortie
              </label>
              <span className="text-[11px] text-earth-600">
                Compression automatique WebP/JPEG
              </span>
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-earth-300 bg-earth-50/70 px-4 py-4 text-sm font-medium text-forest-800 transition hover:border-forest-500 hover:bg-forest-50/60">
              {isCompressing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Compression en cours...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  Ajouter des photos (appareil ou galerie)
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={isCompressing}
              />
            </label>

            {photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {photos.map((src, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-earth-200 bg-earth-100"
                  >
                    <img
                      src={src}
                      alt={`Photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {formatBytes(estimateDataUrlBytes(src))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-red-600/90 p-1 text-white opacity-90 shadow transition hover:bg-red-700"
                      title="Supprimer la photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
              Notes &amp; récit
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Météo, menées des chiens, poste, anecdotes..."
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-earth-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-earth-300 px-4 py-2 text-sm font-medium text-earth-800 transition hover:bg-earth-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || isCompressing}
              className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialHunt ? 'Enregistrer les modifications' : 'Enregistrer la sortie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
