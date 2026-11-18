import React, { useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Users,
  Eye,
  Crosshair,
  Camera,
  RotateCcw,
  Plus,
  Compass,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Navigation,
} from 'lucide-react';
import { Hunt } from '../types';
import { HUNT_TYPES, formatShortDateFr, getHuntingSeason } from '../constants/game';

type SortOption = 'date-desc' | 'date-asc' | 'harvest-desc' | 'seen-desc';

interface HuntsViewProps {
  hunts: Hunt[];
  onAddNew: () => void;
  onSelectHunt: (hunt: Hunt) => void;
  onEditHunt: (hunt: Hunt) => void;
  onDeleteHunt: (id: string) => void;
}

export const HuntsView: React.FC<HuntsViewProps> = ({
  hunts,
  onAddNew,
  onSelectHunt,
  onEditHunt,
  onDeleteHunt,
}) => {
  const [search, setSearch] = useState('');
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [participantFilter, setParticipantFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [onlyHarvested, setOnlyHarvested] = useState(false);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);
  const [onlyGeolocated, setOnlyGeolocated] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      const s = getHuntingSeason(h.date);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [hunts]);

  const availableSpecies = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      h.seenGame.forEach((g) => set.add(g.species));
      h.harvestedGame.forEach((g) => set.add(g.species));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [hunts]);

  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      const loc = h.location.trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [hunts]);

  const availableParticipants = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      h.participants.forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [hunts]);

  const filteredHunts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = hunts.filter((h) => {
      if (seasonFilter !== 'all' && getHuntingSeason(h.date) !== seasonFilter) {
        return false;
      }
      if (typeFilter !== 'all' && h.huntType !== typeFilter) {
        return false;
      }
      if (locationFilter !== 'all' && h.location.trim() !== locationFilter) {
        return false;
      }
      if (
        participantFilter !== 'all' &&
        !h.participants.some((p) => p.trim() === participantFilter)
      ) {
        return false;
      }
      if (dateFrom && h.date < dateFrom) return false;
      if (dateTo && h.date > dateTo) return false;
      if (onlyHarvested && h.harvestedGame.reduce((s, g) => s + g.count, 0) === 0) {
        return false;
      }
      if (onlyWithPhotos && h.photos.length === 0) {
        return false;
      }
      if (onlyGeolocated && !h.coordinates && !(h.posts && h.posts.length > 0)) {
        return false;
      }
      if (speciesFilter !== 'all') {
        const hasSpecies =
          h.seenGame.some((g) => g.species === speciesFilter) ||
          h.harvestedGame.some((g) => g.species === speciesFilter);
        if (!hasSpecies) return false;
      }
      if (q) {
        const haystack = [
          h.location,
          h.huntType,
          h.notes,
          ...h.participants,
          ...h.seenGame.map((g) => g.species),
          ...h.harvestedGame.map((g) => g.species),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      }
      if (sortBy === 'harvest-desc') {
        const hA = a.harvestedGame.reduce((s, g) => s + g.count, 0);
        const hB = b.harvestedGame.reduce((s, g) => s + g.count, 0);
        return hB - hA || b.date.localeCompare(a.date);
      }
      if (sortBy === 'seen-desc') {
        const sA = a.seenGame.reduce((s, g) => s + g.count, 0);
        const sB = b.seenGame.reduce((s, g) => s + g.count, 0);
        return sB - sA || b.date.localeCompare(a.date);
      }
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    hunts,
    search,
    seasonFilter,
    speciesFilter,
    typeFilter,
    locationFilter,
    participantFilter,
    dateFrom,
    dateTo,
    onlyHarvested,
    onlyWithPhotos,
    onlyGeolocated,
    sortBy,
  ]);

  const stats = useMemo(() => {
    const totalSeen = filteredHunts.reduce(
      (sum, h) => sum + h.seenGame.reduce((s, g) => s + g.count, 0),
      0
    );
    const totalHarvested = filteredHunts.reduce(
      (sum, h) => sum + h.harvestedGame.reduce((s, g) => s + g.count, 0),
      0
    );
    const territories = new Set(
      filteredHunts.map((h) => h.location.trim().toLowerCase()).filter(Boolean)
    ).size;
    return {
      count: filteredHunts.length,
      totalSeen,
      totalHarvested,
      territories,
    };
  }, [filteredHunts]);

  const advancedActiveCount =
    (locationFilter !== 'all' ? 1 : 0) +
    (participantFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (onlyHarvested ? 1 : 0) +
    (onlyWithPhotos ? 1 : 0) +
    (onlyGeolocated ? 1 : 0) +
    (sortBy !== 'date-desc' ? 1 : 0);

  const hasActiveFilters =
    search.trim() !== '' ||
    seasonFilter !== 'all' ||
    speciesFilter !== 'all' ||
    typeFilter !== 'all' ||
    advancedActiveCount > 0;

  const resetFilters = () => {
    setSearch('');
    setSeasonFilter('all');
    setSpeciesFilter('all');
    setTypeFilter('all');
    setLocationFilter('all');
    setParticipantFilter('all');
    setDateFrom('');
    setDateTo('');
    setOnlyHarvested(false);
    setOnlyWithPhotos(false);
    setOnlyGeolocated(false);
    setSortBy('date-desc');
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Sorties
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-900">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Gibier vu
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-700">{stats.totalSeen}</p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Prélèvements
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-copper-600">
            {stats.totalHarvested}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Territoires
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-earth-800">
            {stats.territories}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl border border-earth-200 bg-white p-3.5 shadow-sm">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lieu, participant, espèce, note..."
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 py-2 pl-9 pr-3 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Toutes saisons</option>
              {availableSeasons.map((s) => (
                <option key={s} value={s}>
                  Saison {s}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Toutes espèces</option>
              {availableSpecies.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 lg:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Tous types</option>
              {HUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title="Réinitialiser les filtres"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-earth-300 bg-earth-100 px-3 text-earth-800 transition hover:bg-earth-200"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              title="Filtres avancés"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                showAdvanced || advancedActiveCount > 0
                  ? 'border-forest-600 bg-forest-50 text-forest-800'
                  : 'border-earth-300 bg-earth-50/50 text-earth-800 hover:bg-earth-100'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Avancés</span>
              {advancedActiveCount > 0 && (
                <span className="rounded-full bg-forest-700 px-1.5 py-0.5 text-[10px] text-white">
                  {advancedActiveCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mt-3 space-y-3 border-t border-earth-200 pt-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-xs text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
              >
                <option value="all">Tous territoires</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                value={participantFilter}
                onChange={(e) => setParticipantFilter(e.target.value)}
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-xs text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
              >
                <option value="all">Tous participants</option>
                {availableParticipants.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="Date minimum"
                aria-label="Date de début"
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-xs text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
              />

              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="Date maximum"
                aria-label="Date de fin"
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-xs text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-xs text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
              >
                <option value="date-desc">Tri : Plus récentes</option>
                <option value="date-asc">Tri : Plus anciennes</option>
                <option value="harvest-desc">Tri : Plus de prélèvements</option>
                <option value="seen-desc">Tri : Plus d’observations</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOnlyHarvested((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  onlyHarvested
                    ? 'border-copper-600 bg-copper-500/15 text-copper-600'
                    : 'border-earth-300 bg-white text-earth-700 hover:bg-earth-50'
                }`}
              >
                <Crosshair className="h-3.5 w-3.5" />
                Avec prélèvement
              </button>
              <button
                type="button"
                onClick={() => setOnlyWithPhotos((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  onlyWithPhotos
                    ? 'border-forest-600 bg-forest-50 text-forest-800'
                    : 'border-earth-300 bg-white text-earth-700 hover:bg-earth-50'
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                Avec photos
              </button>
              <button
                type="button"
                onClick={() => setOnlyGeolocated((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  onlyGeolocated
                    ? 'border-forest-600 bg-forest-50 text-forest-800'
                    : 'border-earth-300 bg-white text-earth-700 hover:bg-earth-50'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Géolocalisées
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hunts List */}
      {hunts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-earth-300 bg-white/80 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-100 text-forest-700">
            <Compass className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-forest-950">
            Votre carnet de chasse est vide
          </h3>
          <p className="mt-1 max-w-md text-sm text-earth-700">
            Enregistrez votre première sortie pour suivre vos observations, prélèvements,
            participants et photos de terrain.
          </p>
          <button
            type="button"
            onClick={onAddNew}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800"
          >
            <Plus className="h-4 w-4" />
            Ajouter une sortie
          </button>
        </div>
      ) : filteredHunts.length === 0 ? (
        <div className="rounded-2xl border border-earth-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-earth-700">
            Aucune sortie ne correspond à vos critères de recherche.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 text-sm font-semibold text-forest-700 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredHunts.map((hunt) => {
            const seenTotal = hunt.seenGame.reduce((s, g) => s + g.count, 0);
            const harvestedTotal = hunt.harvestedGame.reduce((s, g) => s + g.count, 0);

            return (
              <article
                key={hunt.id}
                onClick={() => onSelectHunt(hunt)}
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-earth-200 bg-white p-4 shadow-sm transition hover:border-forest-400 hover:shadow-md"
              >
                <div>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-forest-100 px-2.5 py-0.5 text-xs font-semibold text-forest-800">
                          {hunt.huntType}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-earth-600">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatShortDateFr(hunt.date)}
                        </span>
                      </div>
                      <h3 className="mt-2 flex items-center gap-1.5 text-lg font-semibold text-forest-950 group-hover:text-forest-700">
                        <MapPin className="h-4 w-4 shrink-0 text-earth-500" />
                        <span className="line-clamp-1">{hunt.location}</span>
                      </h3>
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onEditHunt(hunt)}
                        className="rounded-lg p-1.5 text-earth-600 transition hover:bg-earth-100 hover:text-forest-900"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Supprimer cette sortie de chasse ?')) {
                            onDeleteHunt(hunt.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-earth-600 transition hover:bg-red-50 hover:text-red-700"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Game badges */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-800">
                      <Eye className="h-3.5 w-3.5" />
                      Vu : <strong>{seenTotal}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-copper-500/25 bg-earth-50 px-2.5 py-1 text-xs font-medium text-copper-600">
                      <Crosshair className="h-3.5 w-3.5" />
                      Prélevé : <strong>{harvestedTotal}</strong>
                    </span>
                    {hunt.participants.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-earth-200 bg-earth-50 px-2.5 py-1 text-xs font-medium text-earth-800">
                        <Users className="h-3.5 w-3.5" />
                        {hunt.participants.length}
                      </span>
                    )}
                    {hunt.photos.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-earth-200 bg-earth-50 px-2.5 py-1 text-xs font-medium text-earth-800">
                        <Camera className="h-3.5 w-3.5" />
                        {hunt.photos.length}
                      </span>
                    )}
                    {(hunt.coordinates || (hunt.posts && hunt.posts.length > 0)) && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-800">
                        <Navigation className="h-3.5 w-3.5" />
                        GPS{hunt.posts && hunt.posts.length > 0 ? ` (${hunt.posts.length})` : ''}
                      </span>
                    )}
                  </div>

                  {/* Harvested / Seen quick tags */}
                  {(hunt.harvestedGame.length > 0 || hunt.seenGame.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hunt.harvestedGame.map((g, i) => (
                        <span
                          key={`h-${i}`}
                          className="rounded-md bg-copper-500/10 px-2 py-0.5 text-[11px] font-semibold text-copper-600"
                        >
                          {g.species} ×{g.count}
                        </span>
                      ))}
                      {hunt.seenGame.slice(0, 4).map((g, i) => (
                        <span
                          key={`s-${i}`}
                          className="rounded-md bg-earth-100 px-2 py-0.5 text-[11px] font-medium text-earth-800"
                        >
                          Vu : {g.species} ×{g.count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes excerpt */}
                  {hunt.notes && (
                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-earth-700">
                      {hunt.notes}
                    </p>
                  )}
                </div>

                {/* Photo strip */}
                {hunt.photos.length > 0 && (
                  <div className="mt-3 flex gap-1.5 overflow-hidden pt-2 border-t border-earth-100">
                    {hunt.photos.slice(0, 4).map((src, idx) => (
                      <div
                        key={idx}
                        className="relative h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-earth-200 bg-earth-100"
                      >
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {idx === 3 && hunt.photos.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">
                            +{hunt.photos.length - 4}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
