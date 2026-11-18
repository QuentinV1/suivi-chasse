import React, { useEffect, useState } from 'react';
import {
  Compass,
  Award,
  Plus,
  HardDrive,
  Loader2,
  Trees,
  BarChart3,
  Map as MapIcon,
} from 'lucide-react';
import { ActiveTab, GeoPoint, Hunt, Trophy } from './types';
import {
  deleteHunt,
  deleteTrophy,
  getAllHunts,
  getAllTrophies,
  replaceAllData,
  saveHunt,
  saveTrophy,
} from './utils/db';
import { HuntsView } from './components/HuntsView';
import { HuntFormModal } from './components/HuntFormModal';
import { HuntDetailModal } from './components/HuntDetailModal';
import { TrophiesView } from './components/TrophiesView';
import { TrophyFormModal } from './components/TrophyFormModal';
import { TrophyDetailModal } from './components/TrophyDetailModal';
import { BackupModal } from './components/BackupModal';
import { StatsView } from './components/StatsView';
import { MapView } from './components/MapView';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('hunts');
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hunt modals
  const [isHuntFormOpen, setIsHuntFormOpen] = useState(false);
  const [editingHunt, setEditingHunt] = useState<Hunt | null>(null);
  const [huntInitialCoords, setHuntInitialCoords] = useState<GeoPoint | null>(null);
  const [selectedHunt, setSelectedHunt] = useState<Hunt | null>(null);

  // Map focus
  const [mapFocusPoint, setMapFocusPoint] = useState<GeoPoint | null>(null);

  // Trophy modals
  const [isTrophyFormOpen, setIsTrophyFormOpen] = useState(false);
  const [editingTrophy, setEditingTrophy] = useState<Trophy | null>(null);
  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null);

  // Backup modal
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedHunts, loadedTrophies] = await Promise.all([
        getAllHunts(),
        getAllTrophies(),
      ]);
      setHunts(loadedHunts);
      setTrophies(loadedTrophies);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveHunt = async (hunt: Hunt) => {
    await saveHunt(hunt);
    const updated = await getAllHunts();
    setHunts(updated);
  };

  const handleDeleteHunt = async (id: string) => {
    await deleteHunt(id);
    setHunts((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSaveTrophy = async (trophy: Trophy) => {
    await saveTrophy(trophy);
    const updated = await getAllTrophies();
    setTrophies(updated);
  };

  const handleDeleteTrophy = async (id: string) => {
    await deleteTrophy(id);
    setTrophies((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImport = async (
    importedHunts: Hunt[],
    importedTrophies: Trophy[],
    mode: 'replace' | 'merge'
  ) => {
    if (mode === 'replace') {
      await replaceAllData(importedHunts, importedTrophies);
    } else {
      const huntMap = new Map<string, Hunt>(hunts.map((h) => [h.id, h]));
      importedHunts.forEach((h) => huntMap.set(h.id, h));

      const trophyMap = new Map<string, Trophy>(trophies.map((t) => [t.id, t]));
      importedTrophies.forEach((t) => trophyMap.set(t.id, t));

      await replaceAllData(
        Array.from(huntMap.values()),
        Array.from(trophyMap.values())
      );
    }
    await loadData();
  };

  const openNewModal = () => {
    if (activeTab === 'trophies') {
      setEditingTrophy(null);
      setIsTrophyFormOpen(true);
    } else {
      setEditingHunt(null);
      setHuntInitialCoords(null);
      setIsHuntFormOpen(true);
    }
  };

  const handleViewOnMap = (coords: GeoPoint) => {
    setMapFocusPoint(coords);
    setActiveTab('map');
  };

  return (
    <div className="min-h-screen bg-earth-50 text-forest-950">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/30 bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-earth-400/30 bg-forest-800/80 text-earth-200 shadow-inner">
                <Trees className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-earth-50 sm:text-xl">
                  Carnet de Chasse
                </h1>
                <p className="text-xs text-forest-200">
                  Suivi des sorties &amp; Album trophées
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBackupOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-earth-100 transition hover:bg-white/20 sm:text-sm"
                title="Sauvegarde et portabilité JSON"
              >
                <HardDrive className="h-4 w-4" />
                <span className="hidden sm:inline">Sauvegarde</span>
              </button>

              <button
                type="button"
                onClick={openNewModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-copper-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-copper-600 sm:px-4 sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                {activeTab === 'trophies' ? 'Nouveau trophée' : 'Nouvelle sortie'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('hunts')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
                activeTab === 'hunts'
                  ? 'bg-earth-50 text-forest-950 shadow-sm'
                  : 'text-forest-100 hover:bg-white/10'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>Sorties</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'hunts'
                    ? 'bg-forest-100 text-forest-800'
                    : 'bg-white/15 text-white'
                }`}
              >
                {hunts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('trophies')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
                activeTab === 'trophies'
                  ? 'bg-earth-50 text-forest-950 shadow-sm'
                  : 'text-forest-100 hover:bg-white/10'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Trophées</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'trophies'
                    ? 'bg-copper-500/15 text-copper-600'
                    : 'bg-white/15 text-white'
                }`}
              >
                {trophies.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
                activeTab === 'stats'
                  ? 'bg-earth-50 text-forest-950 shadow-sm'
                  : 'text-forest-100 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Statistiques</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
                activeTab === 'map'
                  ? 'bg-earth-50 text-forest-950 shadow-sm'
                  : 'text-forest-100 hover:bg-white/10'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              <span>Carte</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-earth-700">
            <Loader2 className="h-8 w-8 animate-spin text-forest-700" />
            <p className="mt-3 text-sm font-medium">Chargement du carnet...</p>
          </div>
        ) : activeTab === 'hunts' ? (
          <HuntsView
            hunts={hunts}
            onAddNew={() => {
              setEditingHunt(null);
              setIsHuntFormOpen(true);
            }}
            onSelectHunt={(hunt) => setSelectedHunt(hunt)}
            onEditHunt={(hunt) => {
              setEditingHunt(hunt);
              setIsHuntFormOpen(true);
            }}
            onDeleteHunt={handleDeleteHunt}
          />
        ) : activeTab === 'trophies' ? (
          <TrophiesView
            trophies={trophies}
            onAddNew={() => {
              setEditingTrophy(null);
              setIsTrophyFormOpen(true);
            }}
            onSelectTrophy={(trophy) => setSelectedTrophy(trophy)}
          />
        ) : activeTab === 'stats' ? (
          <StatsView hunts={hunts} trophies={trophies} />
        ) : (
          <MapView
            hunts={hunts}
            trophies={trophies}
            focusPoint={mapFocusPoint}
            onSelectHunt={(hunt) => setSelectedHunt(hunt)}
            onSelectTrophy={(trophy) => setSelectedTrophy(trophy)}
            onCreateHuntAtCoords={(coords) => {
              setEditingHunt(null);
              setHuntInitialCoords(coords);
              setIsHuntFormOpen(true);
            }}
          />
        )}
      </main>

      {/* Modals */}
      {isHuntFormOpen && (
        <HuntFormModal
          initialHunt={editingHunt}
          initialCoords={huntInitialCoords}
          onSave={handleSaveHunt}
          onClose={() => {
            setIsHuntFormOpen(false);
            setEditingHunt(null);
            setHuntInitialCoords(null);
          }}
        />
      )}

      {selectedHunt && (
        <HuntDetailModal
          hunt={selectedHunt}
          onClose={() => setSelectedHunt(null)}
          onEdit={(hunt) => {
            setEditingHunt(hunt);
            setIsHuntFormOpen(true);
          }}
          onDelete={handleDeleteHunt}
          onViewOnMap={handleViewOnMap}
        />
      )}

      {isTrophyFormOpen && (
        <TrophyFormModal
          initialTrophy={editingTrophy}
          onSave={handleSaveTrophy}
          onClose={() => {
            setIsTrophyFormOpen(false);
            setEditingTrophy(null);
          }}
        />
      )}

      {selectedTrophy && (
        <TrophyDetailModal
          trophy={selectedTrophy}
          onClose={() => setSelectedTrophy(null)}
          onEdit={(trophy) => {
            setEditingTrophy(trophy);
            setIsTrophyFormOpen(true);
          }}
          onDelete={handleDeleteTrophy}
          onViewOnMap={handleViewOnMap}
        />
      )}

      {isBackupOpen && (
        <BackupModal
          hunts={hunts}
          trophies={trophies}
          onImport={handleImport}
          onClose={() => setIsBackupOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
