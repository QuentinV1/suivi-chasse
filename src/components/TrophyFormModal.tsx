import React, { useEffect, useState } from 'react';
import { X, Camera, Loader2, Trash2, Calendar, MapPin, Scale, Award } from 'lucide-react';
import { GeoPoint, Trophy } from '../types';
import { TROPHY_SPECIES, generateId, getLocalTodayDate } from '../constants/game';
import { compressImage, estimateDataUrlBytes, formatBytes } from '../utils/image';
import { GpsPickerField } from './GpsPickerField';

interface TrophyFormModalProps {
  initialTrophy?: Trophy | null;
  onSave: (trophy: Trophy) => Promise<void>;
  onClose: () => void;
}

export const TrophyFormModal: React.FC<TrophyFormModalProps> = ({
  initialTrophy,
  onSave,
  onClose,
}) => {
  const today = getLocalTodayDate();

  const initialIsKnown = initialTrophy
    ? TROPHY_SPECIES.includes(initialTrophy.species)
    : true;

  const [speciesChoice, setSpeciesChoice] = useState<string>(
    initialTrophy ? (initialIsKnown ? initialTrophy.species : 'Autre') : TROPHY_SPECIES[0]
  );
  const [customSpecies, setCustomSpecies] = useState<string>(
    initialTrophy && !initialIsKnown ? initialTrophy.species : ''
  );
  const [title, setTitle] = useState<string>(initialTrophy?.title ?? '');
  const [date, setDate] = useState<string>(initialTrophy?.date ?? today);
  const [weightStr, setWeightStr] = useState<string>(
    initialTrophy?.weightKg !== undefined ? String(initialTrophy.weightKg) : ''
  );
  const [location, setLocation] = useState<string>(initialTrophy?.location ?? '');
  const [description, setDescription] = useState<string>(initialTrophy?.description ?? '');
  const [photo, setPhoto] = useState<string | undefined>(initialTrophy?.photo);
  const [coordinates, setCoordinates] = useState<GeoPoint | undefined>(initialTrophy?.coordinates);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 1400, 0.8);
      setPhoto(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement de la photo.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSpecies =
      speciesChoice === 'Autre' ? customSpecies.trim() : speciesChoice.trim();

    if (!finalSpecies) {
      setError('Veuillez préciser le type de gibier.');
      return;
    }
    if (!date) {
      setError('Veuillez sélectionner une date.');
      return;
    }

    const parsedWeight = weightStr.trim()
      ? Number(weightStr.replace(',', '.'))
      : undefined;
    if (parsedWeight !== undefined && (Number.isNaN(parsedWeight) || parsedWeight < 0)) {
      setError('Le poids doit être un nombre positif.');
      return;
    }

    setIsSaving(true);
    setError(null);
    const now = new Date().toISOString();

    const trophy: Trophy = {
      id: initialTrophy?.id ?? generateId('trophy'),
      title: title.trim() || `${finalSpecies}`,
      species: finalSpecies,
      date,
      weightKg: parsedWeight,
      location: location.trim(),
      description: description.trim(),
      photo,
      coordinates,
      createdAt: initialTrophy?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await onSave(trophy);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le trophée.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-earth-200 bg-forest-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-earth-300" />
            <div>
              <h2 className="text-lg font-semibold">
                {initialTrophy ? 'Modifier le trophée' : 'Nouveau trophée'}
              </h2>
              <p className="text-xs text-forest-200">
                Indépendant d’une sortie — archivez vos plus belles pièces
              </p>
            </div>
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

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Photo */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Camera className="h-3.5 w-3.5" />
                Photo du trophée
              </label>
              {photo && (
                <span className="text-[11px] text-earth-600">
                  {formatBytes(estimateDataUrlBytes(photo))}
                </span>
              )}
            </div>

            {photo ? (
              <div className="relative overflow-hidden rounded-xl border border-earth-200 bg-earth-100">
                <img
                  src={photo}
                  alt="Aperçu du trophée"
                  className="max-h-60 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(undefined)}
                  className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-red-600/90 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Retirer
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-earth-300 bg-earth-50/70 px-4 py-6 text-center transition hover:border-forest-500 hover:bg-forest-50/60">
                {isCompressing ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-forest-700" />
                    <span className="text-sm font-medium text-forest-800">
                      Compression en cours...
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="h-6 w-6 text-forest-700" />
                    <span className="text-sm font-medium text-forest-800">
                      Choisir ou prendre une photo
                    </span>
                    <span className="text-xs text-earth-600">
                      Compression automatique WebP/JPEG
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isCompressing}
                />
              </label>
            )}
          </div>

          {/* Species + Title */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
                Type de gibier
              </label>
              <select
                value={speciesChoice}
                onChange={(e) => setSpeciesChoice(e.target.value)}
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              >
                {TROPHY_SPECIES.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}
                  </option>
                ))}
              </select>
            </div>

            {speciesChoice === 'Autre' ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
                  Préciser l’espèce
                </label>
                <input
                  type="text"
                  value={customSpecies}
                  onChange={(e) => setCustomSpecies(e.target.value)}
                  placeholder="Ex : Isard, Grand Tétras..."
                  required
                  className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
                  Intitulé (optionnel)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Grand brocard 6 pointes"
                  className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                />
              </div>
            )}
          </div>

          {speciesChoice === 'Autre' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
                Intitulé (optionnel)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Trophée d’exception..."
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
          )}

          {/* Date + Weight */}
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
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
                <Scale className="h-3.5 w-3.5" />
                Poids (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="Ex : 84.5"
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
              <MapPin className="h-3.5 w-3.5" />
              Lieu
            </label>
            <input
              type="text"
              value={location}
              maxLength={120}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex : Massif des Vosges, Sologne..."
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <GpsPickerField
            value={coordinates}
            onChange={setCoordinates}
            label="Position GPS du prélèvement (optionnel)"
          />

          {/* Description / Mensurations */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-earth-700">
              Description &amp; mensurations
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Longueur des défenses, pointes, cotation CIC, circonstances..."
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          {/* Footer */}
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
              {initialTrophy ? 'Enregistrer' : 'Ajouter à l’album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
