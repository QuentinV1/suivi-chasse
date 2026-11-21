import React, { useMemo, useState } from 'react';
import { BarChart3, Award, Compass, MapPin, Eye, Crosshair, RotateCcw } from 'lucide-react';
import { Hunt, Trophy } from '../types';
import { formatShortDateFr, getHuntingSeason } from '../constants/game';

interface StatsViewProps {
  hunts: Hunt[];
  trophies: Trophy[];
}

export const StatsView: React.FC<StatsViewProps> = ({ hunts, trophies }) => {
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [territoryFilter, setTerritoryFilter] = useState<string>('all');

  const availableSeasons = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      const s = getHuntingSeason(h.date);
      if (s) set.add(s);
    });
    trophies.forEach((t) => {
      const s = getHuntingSeason(t.date);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [hunts, trophies]);

  const availableTerritories = useMemo(() => {
    const set = new Set<string>();
    hunts.forEach((h) => {
      const loc = h.location.trim();
      if (loc) set.add(loc);
    });
    trophies.forEach((t) => {
      const loc = t.location.trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [hunts, trophies]);

  const filteredHunts = useMemo(() => {
    return hunts.filter((h) => {
      if (seasonFilter !== 'all' && getHuntingSeason(h.date) !== seasonFilter) {
        return false;
      }
      if (territoryFilter !== 'all' && h.location.trim() !== territoryFilter) {
        return false;
      }
      return true;
    });
  }, [hunts, seasonFilter, territoryFilter]);

  const filteredTrophies = useMemo(() => {
    return trophies.filter((t) => {
      if (seasonFilter !== 'all' && getHuntingSeason(t.date) !== seasonFilter) {
        return false;
      }
      if (territoryFilter !== 'all' && t.location.trim() !== territoryFilter) {
        return false;
      }
      return true;
    });
  }, [trophies, seasonFilter, territoryFilter]);

  const summary = useMemo(() => {
    const totalSeen = filteredHunts.reduce(
      (sum, h) => sum + h.seenGame.reduce((s, g) => s + g.count, 0),
      0
    );
    const totalHarvested = filteredHunts.reduce(
      (sum, h) => sum + h.harvestedGame.reduce((s, g) => s + g.count, 0),
      0
    );
    const huntsWithHarvest = filteredHunts.filter(
      (h) => h.harvestedGame.reduce((s, g) => s + g.count, 0) > 0
    ).length;
    const successRate =
      filteredHunts.length > 0
        ? Math.round((huntsWithHarvest / filteredHunts.length) * 100)
        : 0;
    const territoriesCount = new Set(
      filteredHunts.map((h) => h.location.trim().toLowerCase()).filter(Boolean)
    ).size;

    return {
      huntsCount: filteredHunts.length,
      totalSeen,
      totalHarvested,
      successRate,
      territoriesCount,
      trophiesCount: filteredTrophies.length,
    };
  }, [filteredHunts, filteredTrophies]);

  const bySeason = useMemo(() => {
    const map = new Map<
      string,
      { season: string; hunts: number; seen: number; harvested: number; trophies: number }
    >();

    for (const h of filteredHunts) {
      const season = getHuntingSeason(h.date) || 'Inconnue';
      const entry = map.get(season) ?? {
        season,
        hunts: 0,
        seen: 0,
        harvested: 0,
        trophies: 0,
      };
      entry.hunts += 1;
      entry.seen += h.seenGame.reduce((s, g) => s + g.count, 0);
      entry.harvested += h.harvestedGame.reduce((s, g) => s + g.count, 0);
      map.set(season, entry);
    }

    for (const t of filteredTrophies) {
      const season = getHuntingSeason(t.date) || 'Inconnue';
      const entry = map.get(season) ?? {
        season,
        hunts: 0,
        seen: 0,
        harvested: 0,
        trophies: 0,
      };
      entry.trophies += 1;
      map.set(season, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.season.localeCompare(a.season));
  }, [filteredHunts, filteredTrophies]);

  const bySpecies = useMemo(() => {
    const map = new Map<string, { species: string; seen: number; harvested: number }>();

    for (const h of filteredHunts) {
      for (const g of h.seenGame) {
        const entry = map.get(g.species) ?? { species: g.species, seen: 0, harvested: 0 };
        entry.seen += g.count;
        map.set(g.species, entry);
      }
      for (const g of h.harvestedGame) {
        const entry = map.get(g.species) ?? { species: g.species, seen: 0, harvested: 0 };
        entry.harvested += g.count;
        map.set(g.species, entry);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.harvested - a.harvested || b.seen - a.seen
    );
  }, [filteredHunts]);

  const maxSpeciesTotal = useMemo(() => {
    return bySpecies.reduce((max, s) => Math.max(max, s.seen, s.harvested), 1);
  }, [bySpecies]);

  const byTerritory = useMemo(() => {
    const map = new Map<
      string,
      { location: string; hunts: number; seen: number; harvested: number; lastDate: string }
    >();

    for (const h of filteredHunts) {
      const loc = h.location.trim() || 'Lieu non précisé';
      const entry = map.get(loc) ?? {
        location: loc,
        hunts: 0,
        seen: 0,
        harvested: 0,
        lastDate: h.date,
      };
      entry.hunts += 1;
      entry.seen += h.seenGame.reduce((s, g) => s + g.count, 0);
      entry.harvested += h.harvestedGame.reduce((s, g) => s + g.count, 0);
      if (h.date > entry.lastDate) entry.lastDate = h.date;
      map.set(loc, entry);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.hunts - a.hunts || b.harvested - a.harvested
    );
  }, [filteredHunts]);

  const byHuntType = useMemo(() => {
    const map = new Map<string, { huntType: string; hunts: number; harvested: number }>();
    for (const h of filteredHunts) {
      const entry = map.get(h.huntType) ?? { huntType: h.huntType, hunts: 0, harvested: 0 };
      entry.hunts += 1;
      entry.harvested += h.harvestedGame.reduce((s, g) => s + g.count, 0);
      map.set(h.huntType, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.hunts - a.hunts);
  }, [filteredHunts]);

  const hasFilters = seasonFilter !== 'all' || territoryFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-earth-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-forest-950">
          <BarChart3 className="h-4 w-4 text-forest-700" />
          <span>Statistiques cynégétiques</span>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <select
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value)}
            className="w-full min-w-0 max-w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-1.5 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none sm:w-auto"
          >
            <option value="all">Toutes saisons</option>
            {availableSeasons.map((s) => (
              <option key={s} value={s}>
                Saison {s}
              </option>
            ))}
          </select>

          <select
            value={territoryFilter}
            onChange={(e) => setTerritoryFilter(e.target.value)}
            className="w-full min-w-0 max-w-full rounded-xl border border-earth-300 bg-earth-50/50 px-3 py-1.5 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none sm:w-auto sm:max-w-[220px]"
          >
            <option value="all">Tous territoires</option>
            {availableTerritories.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSeasonFilter('all');
                setTerritoryFilter('all');
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-earth-300 bg-earth-100 px-2.5 py-1.5 text-xs font-medium text-earth-800 hover:bg-earth-200"
              title="Réinitialiser"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Sorties
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-950">
            {summary.huntsCount}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Gibier vu
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-700">
            {summary.totalSeen}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Prélevés
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-copper-600">
            {summary.totalHarvested}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Sorties positives
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-forest-800">
            {summary.successRate}%
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Territoires
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-earth-800">
            {summary.territoriesCount}
          </p>
        </div>
        <div className="rounded-2xl border border-earth-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-earth-600">
            Trophées
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-copper-600">
            {summary.trophiesCount}
          </p>
        </div>
      </div>

      {filteredHunts.length === 0 && filteredTrophies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-earth-300 bg-white/80 px-6 py-12 text-center text-sm text-earth-700">
          Aucune donnée disponible pour cette sélection.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Par Saison */}
          <section className="min-w-0 rounded-2xl border border-earth-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-950">
              <Compass className="h-4 w-4 text-forest-700" />
              Bilan par saison
            </h3>
            {bySeason.length === 0 ? (
              <p className="text-xs text-earth-600">Aucune saison enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-earth-200 text-xs text-earth-600">
                      <th className="whitespace-nowrap pb-2 pr-3 font-semibold">Saison</th>
                      <th className="whitespace-nowrap pb-2 px-2 text-right font-semibold">Sorties</th>
                      <th className="whitespace-nowrap pb-2 px-2 text-right font-semibold">Vu</th>
                      <th className="whitespace-nowrap pb-2 px-2 text-right font-semibold">Prélevé</th>
                      <th className="whitespace-nowrap pb-2 pl-2 text-right font-semibold">Trophées</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-earth-100">
                    {bySeason.map((row) => (
                      <tr key={row.season} className="text-forest-950">
                        <td className="whitespace-nowrap py-2.5 pr-3 font-semibold">{row.season}</td>
                        <td className="whitespace-nowrap py-2.5 px-2 text-right">{row.hunts}</td>
                        <td className="whitespace-nowrap py-2.5 px-2 text-right text-forest-700">{row.seen}</td>
                        <td className="whitespace-nowrap py-2.5 px-2 text-right font-semibold text-copper-600">
                          {row.harvested}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pl-2 text-right">{row.trophies}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Par Espèce */}
          <section className="min-w-0 rounded-2xl border border-earth-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-950">
              <Crosshair className="h-4 w-4 text-copper-600" />
              Par espèce (Vu vs Prélevé)
            </h3>
            {bySpecies.length === 0 ? (
              <p className="text-xs text-earth-600">Aucune espèce renseignée.</p>
            ) : (
              <div className="space-y-3">
                {bySpecies.map((sp) => (
                  <div key={sp.species} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-forest-950">
                      <span>{sp.species}</span>
                      <span className="flex items-center gap-3 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-forest-700">
                          <Eye className="h-3 w-3" /> {sp.seen}
                        </span>
                        <span className="inline-flex items-center gap-1 text-copper-600">
                          <Crosshair className="h-3 w-3" /> {sp.harvested}
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-earth-100">
                        <div
                          className="h-full rounded-full bg-forest-600"
                          style={{ width: `${Math.round((sp.seen / maxSpeciesTotal) * 100)}%` }}
                        />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-earth-100">
                        <div
                          className="h-full rounded-full bg-copper-500"
                          style={{
                            width: `${Math.round((sp.harvested / maxSpeciesTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Par Territoire */}
          <section className="min-w-0 rounded-2xl border border-earth-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-950">
              <MapPin className="h-4 w-4 text-earth-700" />
              Par territoire / lieu
            </h3>
            {byTerritory.length === 0 ? (
              <p className="text-xs text-earth-600">Aucun territoire enregistré.</p>
            ) : (
              <div className="space-y-2.5">
                {byTerritory.map((terr) => (
                  <div
                    key={terr.location}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-earth-100 bg-earth-50/60 px-3.5 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-forest-950">{terr.location}</p>
                      <p className="text-[11px] text-earth-600">
                        Dernière sortie : {formatShortDateFr(terr.lastDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-medium sm:gap-3">
                      <span className="rounded-md bg-white px-2 py-0.5 text-forest-900">
                        {terr.hunts} sortie{terr.hunts > 1 ? 's' : ''}
                      </span>
                      <span className="text-forest-700">Vu : {terr.seen}</span>
                      <span className="font-bold text-copper-600">Prélevé : {terr.harvested}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Par Mode de chasse */}
          <section className="min-w-0 rounded-2xl border border-earth-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-forest-950">
              <Award className="h-4 w-4 text-forest-700" />
              Répartition par type de chasse
            </h3>
            {byHuntType.length === 0 ? (
              <p className="text-xs text-earth-600">Aucune donnée.</p>
            ) : (
              <div className="space-y-2.5">
                {byHuntType.map((ht) => {
                  const pct =
                    filteredHunts.length > 0
                      ? Math.round((ht.hunts / filteredHunts.length) * 100)
                      : 0;
                  return (
                    <div key={ht.huntType} className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-forest-950">{ht.huntType}</span>
                        <span className="text-earth-700">
                          {ht.hunts} sortie{ht.hunts > 1 ? 's' : ''} ({pct}%) •{' '}
                          <strong className="text-copper-600">{ht.harvested}</strong> prélevé
                          {ht.harvested > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-earth-100">
                        <div
                          className="h-full rounded-full bg-forest-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
