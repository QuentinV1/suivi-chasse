import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Compass,
  Award,
  Plus,
  HardDrive,
  Loader2,
  Trees,
  BarChart3,
  Map as MapIcon,
  LogOut,
  UploadCloud,
  X,
} from 'lucide-react';
import { ActiveTab, GeoPoint, Hunt, Trophy } from './types';
import { auth, isFirebaseConfigured } from './lib/firebase';
import {
  clearLegacyLocalData,
  deleteHunt,
  deleteTrophy,
  getLegacyLocalData,
  mergeData,
  replaceAllData,
  saveHunt,
  saveTrophy,
  subscribeToHunts,
  subscribeToTrophies,
} from './utils/db';
import { AuthScreen } from './components/AuthScreen';
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
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);

  const [activeTab, setActiveTab] = useState<ActiveTab>('hunts');
  const [hunts, setHunts] = useState<Hunt[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Legacy local data migration banner
  const [legacyData, setLegacyData] = useState<{
    hunts: Hunt[];
    trophies: Trophy[];
  } | null>(null);
  const [isMigratingLegacy, setIsMigratingLegacy] = useState(false);

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

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setHunts([]);
        setTrophies([]);
        setSelectedHunt(null);
        setSelectedTrophy(null);
        setLegacyData(null);
        setSyncError(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    setSyncError(null);

    let huntsLoaded = false;
    let trophiesLoaded = false;
    const markLoaded = () => {
      if (huntsLoaded && trophiesLoaded) {
        setIsLoading(false);
      }
    };

    const unsubHunts = subscribeToHunts(
      user.uid,
      (loadedHunts) => {
        setHunts(loadedHunts);
        huntsLoaded = true;
        markLoaded();
      },
      (err) => {
        console.error('Erreur Firestore (sorties):', err);
        setSyncError('Impossible de synchroniser vos sorties avec Firestore.');
        huntsLoaded = true;
        markLoaded();
      }
    );

    const unsubTrophies = subscribeToTrophies(
      user.uid,
      (loadedTrophies) => {
        setTrophies(loadedTrophies);
        trophiesLoaded = true;
        markLoaded();
      },
      (err) => {
        console.error('Erreur Firestore (trophées):', err);
        setSyncError('Impossible de synchroniser vos trophées avec Firestore.');
        trophiesLoaded = true;
        markLoaded();
      }
    );

    void getLegacyLocalData().then((local) => {
      if (local.hunts.length > 0 || local.trophies.length > 0) {
        setLegacyData(local);
      }
    });

    return () => {
      unsubHunts();
      unsubTrophies();
    };
  }, [user]);

  const handleMigrateLegacyData = async () => {
    if (!user || !legacyData) return;
    setIsMigratingLegacy(true);
    try {
      await mergeData(user.uid, legacyData.hunts, legacyData.trophies);
      await clearLegacyLocalData();
      setLegacyData(null);
    } catch (err) {
      console.error('Erreur migration locale:', err);
      setSyncError('Échec de l’importation des données locales.');
    } finally {
      setIsMigratingLegacy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const handleSaveHunt = async (hunt: Hunt) => {
    if (!user) return;
    await saveHunt(user.uid, hunt);
  };

  const handleDeleteHunt = async (id: string) => {
    if (!user) return;
    await deleteHunt(user.uid, id);
  };

  const handleSaveTrophy = async (trophy: Trophy) => {
    if (!user) return;
    await saveTrophy(user.uid, trophy);
  };

  const handleDeleteTrophy = async (id: string) => {
    if (!user) return;
    await deleteTrophy(user.uid, id);
  };

  const handleImport = async (
    importedHunts: Hunt[],
    importedTrophies: Trophy[],
    mode: 'replace' | 'merge'
  ) => {
    if (!user) return;
    if (mode === 'replace') {
      await replaceAllData(user.uid, importedHunts, importedTrophies);
    } else {
      await mergeData(user.uid, importedHunts, importedTrophies);
    }
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

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 text-earth-700">
        <Loader2 className="h-8 w-8 animate-spin text-forest-700" />
        <p className="mt-3 text-sm font-medium">Vérification de la session...</p>
      </div>
    );
  }

  if (!isFirebaseConfigured || !user) {
    return <AuthScreen />;
  }

  const userLabel = user.displayName || user.email || 'Chasseur';

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
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="hidden max-w-[180px] truncate rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-forest-100 md:inline-block"
                title={user.email ?? userLabel}
              >
                {userLabel}
              </span>

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

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 text-xs font-semibold text-earth-100 transition hover:bg-red-500/25 sm:px-3 sm:text-sm"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Déconnexion</span>
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
        {syncError && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 sm:text-sm">
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="rounded-lg p-1 text-red-600 hover:bg-red-100"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {legacyData && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-forest-300 bg-forest-50 px-4 py-3 text-xs text-forest-900 sm:text-sm">
            <div className="flex items-center gap-2.5">
              <UploadCloud className="h-5 w-5 shrink-0 text-forest-700" />
              <span>
                Des données locales ont été trouvées sur cet appareil (
                <strong>{legacyData.hunts.length}</strong> sortie(s),{' '}
                <strong>{legacyData.trophies.length}</strong> trophée(s)). Voulez-vous les
                importer dans votre compte ?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isMigratingLegacy}
                onClick={handleMigrateLegacyData}
                className="inline-flex items-center gap-1.5 rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-forest-900 disabled:opacity-60"
              >
                {isMigratingLegacy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Importer
              </button>
              <button
                type="button"
                disabled={isMigratingLegacy}
                onClick={() => setLegacyData(null)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-earth-700 hover:bg-forest-100"
              >
                Ignorer
              </button>
            </div>
          </div>
        )}

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
