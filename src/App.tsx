import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Cloud,
  MessageSquarePlus,
  User as UserIcon,
} from 'lucide-react';
import { ActiveTab, GeoPoint, Hunt, Trophy } from './types';
import { auth, db, isFirebaseConfigured } from './lib/firebase';
import { clearHubAuthCache, verifyUserAccess } from './lib/accessControl';
import {
  activerSyncCloud,
  arreterListenersFirestore,
  cloudState as initialCloudState,
  deleteHunt,
  deleteTrophy,
  getAllLocalHunts,
  getAllLocalTrophies,
  mergeData,
  reinitialiserEtatCloud,
  replaceAllData,
  saveHunt,
  saveTrophy,
  subscribeToCloudState,
  type CloudState,
} from './utils/db';
import { AuthScreen } from './components/AuthScreen';
import { FeedbackModal } from './components/FeedbackModal';
import { AccessGate, type AccessGateState } from './components/AccessGate';
import { HuntsView } from './components/HuntsView';
import { HuntFormModal } from './components/HuntFormModal';
import { HuntDetailModal } from './components/HuntDetailModal';
import { TrophiesView } from './components/TrophiesView';
import { TrophyFormModal } from './components/TrophyFormModal';
import { TrophyDetailModal } from './components/TrophyDetailModal';
import { BackupModal } from './components/BackupModal';
import { StatsView } from './components/StatsView';
import { MapView } from './components/MapView';

export const APP_VERSION = '1.1.0';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [gate, setGate] = useState<AccessGateState>({ phase: 'loading' });
  const userRef = useRef<User | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>(initialCloudState);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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

  // 1. Chargement initial des données locales (IndexedDB / localStorage)
  useEffect(() => {
    let mounted = true;
    Promise.all([getAllLocalHunts(), getAllLocalTrophies()])
      .then(([localHunts, localTrophies]) => {
        if (!mounted) return;
        setHunts(localHunts);
        setTrophies(localTrophies);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Abonnement à l'état de synchronisation Cloud
  useEffect(() => {
    return subscribeToCloudState((nextState) => {
      setCloudState(nextState);
    });
  }, []);

  const startCloudSync = useCallback(() => {
    activerSyncCloud({
      onHuntsUpdated: (updatedHunts) => {
        setHunts(updatedHunts);
        setSelectedHunt((prev) =>
          prev ? updatedHunts.find((h) => h.id === prev.id) ?? null : null
        );
      },
      onTrophiesUpdated: (updatedTrophies) => {
        setTrophies(updatedTrophies);
        setSelectedTrophy((prev) =>
          prev ? updatedTrophies.find((t) => t.id === prev.id) ?? null : null
        );
      },
    });
  }, []);

  const runAccessCheck = useCallback(
    async (targetUser: User, background = false) => {
      if (!background) {
        setGate({ phase: 'loading' });
      }
      const res = await verifyUserAccess(db, 'suivi-chasse', targetUser);
      if (userRef.current?.uid !== targetUser.uid) return;
      if (res.outcome === 'authorized') {
        setGate({ phase: 'authorized', status: res.status, offline: res.offline });
        startCloudSync();
      } else if (res.outcome === 'unauthorized') {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'unauthorized', email: res.email });
      } else {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'offline_unverified', email: res.email });
      }
    },
    [startCloudSync],
  );

  const handleGateSignOut = useCallback(async () => {
    clearHubAuthCache('suivi-chasse');
    arreterListenersFirestore();
    if (auth) {
      await signOut(auth);
    }
    reinitialiserEtatCloud();
    userRef.current = null;
    setUser(null);
    setGate({ phase: 'unauthenticated' });
  }, []);

  // 3. Observation de l'authentification Firebase + contrôle d'accès
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setGate({ phase: 'unauthenticated' });
      return;
    }

    const onOnline = () => {
      if (userRef.current) {
        void runAccessCheck(userRef.current, true);
      }
    };
    window.addEventListener('online', onOnline);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      userRef.current = currentUser || null;
      setUser(currentUser || null);
      if (currentUser) {
        void runAccessCheck(currentUser, false);
      } else {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setGate({ phase: 'unauthenticated' });
      }
    });

    return () => {
      window.removeEventListener('online', onOnline);
      unsubscribe();
      arreterListenersFirestore();
    };
  }, [runAccessCheck]);

  const handleSaveHunt = async (hunt: Hunt) => {
    const nextHunts = await saveHunt(hunt);
    setHunts(nextHunts);
    if (selectedHunt && selectedHunt.id === hunt.id) {
      setSelectedHunt(hunt);
    }
  };

  const handleDeleteHunt = async (id: string) => {
    const nextHunts = await deleteHunt(id);
    setHunts(nextHunts);
    if (selectedHunt && selectedHunt.id === id) {
      setSelectedHunt(null);
    }
  };

  const handleSaveTrophy = async (trophy: Trophy) => {
    const nextTrophies = await saveTrophy(trophy);
    setTrophies(nextTrophies);
    if (selectedTrophy && selectedTrophy.id === trophy.id) {
      setSelectedTrophy(trophy);
    }
  };

  const handleDeleteTrophy = async (id: string) => {
    const nextTrophies = await deleteTrophy(id);
    setTrophies(nextTrophies);
    if (selectedTrophy && selectedTrophy.id === id) {
      setSelectedTrophy(null);
    }
  };

  const handleImport = async (
    importedHunts: Hunt[],
    importedTrophies: Trophy[],
    mode: 'replace' | 'merge'
  ) => {
    if (mode === 'replace') {
      const res = await replaceAllData(importedHunts, importedTrophies);
      setHunts(res.hunts);
      setTrophies(res.trophies);
    } else {
      const res = await mergeData(importedHunts, importedTrophies);
      setHunts(res.hunts);
      setTrophies(res.trophies);
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

  const authButtonLabel = user
    ? (user.email || user.displayName || 'Cloud').split('@')[0]
    : 'Connexion';

  if (gate.phase !== 'authorized') {
    return (
      <AccessGate
        gate={gate}
        user={user}
        onRetryVerification={() => {
          if (userRef.current) {
            void runAccessCheck(userRef.current, false);
          }
        }}
        onSignOut={handleGateSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-earth-50 text-forest-950">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/30 bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Brand */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-earth-400/30 bg-forest-800/80 text-earth-200 shadow-inner">
                <Trees className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-lg font-bold tracking-tight text-earth-50 sm:text-xl">
                    Carnet de Chasse
                  </h1>
                  <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-forest-200">
                    v{APP_VERSION}
                  </span>
                </div>
                <p className="truncate text-xs text-forest-200">
                  Suivi des sorties &amp; Album trophées
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => setFeedbackOpen(true)}
                title="Envoyer un feedback (évolution ou bug)"
                aria-label="Envoyer un feedback"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-earth-100 transition hover:bg-white/20 sm:text-sm"
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Feedback</span>
              </button>
              <button
                id="btn-auth-header"
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  user
                    ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25'
                    : 'border-white/15 bg-white/10 text-earth-100 hover:bg-white/20'
                }`}
                title={
                  user
                    ? `Connecté : ${user.email || user.uid}`
                    : 'Se connecter au Cloud'
                }
              >
                {user ? (
                  <UserIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <Cloud className="h-4 w-4 shrink-0" />
                )}
                <span className="max-w-[120px] truncate">{authButtonLabel}</span>
              </button>

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
          <nav className="scrollbar-none mt-3 flex flex-nowrap gap-1.5 overflow-x-auto border-t border-white/10 pt-3 sm:flex-wrap sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('hunts')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
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
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
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
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
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
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3.5 sm:text-sm ${
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
        {user && cloudState.syncError && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 sm:text-sm">
            <span className="min-w-0 flex-1 break-words">{cloudState.syncError}</span>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-200"
            >
              Compte Cloud
            </button>
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
      <FeedbackModal
        open={feedbackOpen}
        user={user}
        db={db}
        context={`tab=${activeTab}`}
        onClose={() => setFeedbackOpen(false)}
      />

      {isAuthModalOpen && (
        <AuthScreen
          user={user}
          cloudState={cloudState}
          totalItemsCount={hunts.length + trophies.length}
          onClose={() => setIsAuthModalOpen(false)}
          onRestartSync={startCloudSync}
          onUserReloaded={(reloadedUser) => setUser(reloadedUser)}
        />
      )}

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
