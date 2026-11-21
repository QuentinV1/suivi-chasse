import React, { useMemo, useState } from 'react';
import {
  Search,
  Award,
  Scale,
  MapPin,
  Calendar,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Trophy } from '../types';
import { formatShortDateFr } from '../constants/game';

interface TrophiesViewProps {
  trophies: Trophy[];
  onAddNew: () => void;
  onSelectTrophy: (trophy: Trophy) => void;
}

export const TrophiesView: React.FC<TrophiesViewProps> = ({
  trophies,
  onAddNew,
  onSelectTrophy,
}) => {
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const availableSpecies = useMemo(() => {
    const set = new Set<string>();
    trophies.forEach((t) => set.add(t.species));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [trophies]);

  const availableYears = useMemo(() => {
    const set = new Set<string>();
    trophies.forEach((t) => {
      if (t.date && t.date.length >= 4) {
        set.add(t.date.slice(0, 4));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [trophies]);

  const filteredTrophies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trophies.filter((t) => {
      if (speciesFilter !== 'all' && t.species !== speciesFilter) return false;
      if (yearFilter !== 'all' && !t.date.startsWith(yearFilter)) return false;
      if (q) {
        const haystack = [t.title, t.species, t.location, t.description]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [trophies, search, speciesFilter, yearFilter]);

  const stats = useMemo(() => {
    const weights = filteredTrophies
      .map((t) => t.weightKg)
      .filter((w): w is number => typeof w === 'number' && !Number.isNaN(w));
    const maxWeight = weights.length > 0 ? Math.max(...weights) : null;

    const counts: Record<string, number> = {};
    filteredTrophies.forEach((t) => {
      counts[t.species] = (counts[t.species] ?? 0) + 1;
    });
    const topSpecies =
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      total: filteredTrophies.length,
      maxWeight,
      topSpecies,
    };
  }, [filteredTrophies]);

  const hasFilters =
    search.trim() !== '' || speciesFilter !== 'all' || yearFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setSpeciesFilter('all');
    setYearFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Trophées
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-900">
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Espèce dominante
          </p>
          <p className="mt-1 truncate font-serif text-2xl font-bold text-forest-700">
            {stats.topSpecies}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-earth-600">
            Poids record
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-copper-600">
            {stats.maxWeight !== null ? `${stats.maxWeight} kg` : '—'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-earth-200 bg-white p-3.5 shadow-sm">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un trophée, lieu, mensuration..."
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 py-2 pl-9 pr-3 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Tous gibiers</option>
              {availableSpecies.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 sm:col-span-3">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-2 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none"
            >
              <option value="all">Toutes années</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                title="Réinitialiser les filtres"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-earth-300 bg-earth-100 px-3 text-earth-800 transition hover:bg-earth-200"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gallery */}
      {trophies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-earth-300 bg-white/80 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-earth-100 text-copper-600">
            <Award className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-forest-950">
            Votre album trophées est vide
          </h3>
          <p className="mt-1 max-w-md text-sm text-earth-700">
            Ajoutez vos plus beaux trophées avec photo, poids, lieu et mensurations —
            indépendamment de vos sorties enregistrées.
          </p>
          <button
            type="button"
            onClick={onAddNew}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800"
          >
            <Plus className="h-4 w-4" />
            Ajouter un trophée
          </button>
        </div>
      ) : filteredTrophies.length === 0 ? (
        <div className="rounded-2xl border border-earth-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-medium text-earth-700">
            Aucun trophée ne correspond à vos filtres.
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrophies.map((trophy) => (
            <article
              key={trophy.id}
              onClick={() => onSelectTrophy(trophy)}
              className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-sm transition hover:border-forest-400 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-forest-950">
                {trophy.photo ? (
                  <img
                    src={trophy.photo}
                    alt={trophy.title || trophy.species}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-forest-900 to-forest-950 text-earth-300/80">
                    <Award className="h-10 w-10" />
                  </div>
                )}

                <span className="absolute left-3 top-3 rounded-full bg-forest-950/80 px-2.5 py-0.5 text-xs font-semibold text-earth-100 backdrop-blur-sm">
                  {trophy.species}
                </span>

                {trophy.weightKg !== undefined && (
                  <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-lg bg-copper-600/90 px-2.5 py-1 text-xs font-bold text-white shadow backdrop-blur-sm">
                    <Scale className="h-3 w-3" />
                    {trophy.weightKg} kg
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="line-clamp-1 text-base font-semibold text-forest-950 group-hover:text-forest-700">
                    {trophy.title || trophy.species}
                  </h3>
                  {trophy.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-earth-700">
                      {trophy.description}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-earth-100 pt-2.5 text-xs text-earth-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatShortDateFr(trophy.date)}
                  </span>
                  {trophy.location && (
                    <span className="flex min-w-0 max-w-[55%] items-center gap-1 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{trophy.location}</span>
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
