import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Hunt, Trophy } from '../types';

export const HUNTS_COLLECTION = 'chasse_hunts';
export const TROPHIES_COLLECTION = 'chasse_trophies';

const DB_NAME = 'suivi-chasse-db';
const DB_VERSION = 1;
const HUNTS_STORE = 'hunts';
const TROPHIES_STORE = 'trophies';
const FALLBACK_HUNTS_KEY = 'suivi_chasse_hunts_fallback_v1';
const FALLBACK_TROPHIES_KEY = 'suivi_chasse_trophies_fallback_v1';

export const LAST_UID_KEY = 'suivi_chasse_last_uid';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface CloudState {
  initialSyncDone: boolean;
  syncedCols: Record<string, boolean>;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
}

export const cloudState: CloudState = {
  initialSyncDone: false,
  syncedCols: {},
  syncStatus: 'idle',
  syncError: null,
  lastSyncedAt: null,
};

type CloudStateListener = (state: CloudState) => void;
const cloudStateListeners = new Set<CloudStateListener>();

function notifyCloudState() {
  const snapshot: CloudState = {
    ...cloudState,
    syncedCols: { ...cloudState.syncedCols },
  };
  cloudStateListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeToCloudState(listener: CloudStateListener): () => void {
  cloudStateListeners.add(listener);
  listener({
    ...cloudState,
    syncedCols: { ...cloudState.syncedCols },
  });
  return () => {
    cloudStateListeners.delete(listener);
  };
}

let _suppressCloudSync = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _unsubListeners: Unsubscribe[] = [];

export function arreterListenersFirestore(): void {
  _unsubListeners.forEach((unsub) => {
    try {
      unsub();
    } catch {
      // ignore
    }
  });
  _unsubListeners = [];
}

export function reinitialiserEtatCloud(): void {
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  cloudState.initialSyncDone = false;
  cloudState.syncedCols = {};
  cloudState.syncStatus = 'idle';
  cloudState.syncError = null;
  cloudState.lastSyncedAt = null;
  notifyCloudState();
}

export function estConnecteFirebase(): boolean {
  return Boolean(auth?.currentUser);
}

// ===============================================================
// Stockage Local (IndexedDB + fallback localStorage) = Source de l'UI
// ===============================================================

function openLocalDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(HUNTS_STORE)) {
        idb.createObjectStore(HUNTS_STORE, { keyPath: 'id' });
      }
      if (!idb.objectStoreNames.contains(TROPHIES_STORE)) {
        idb.createObjectStore(TROPHIES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erreur ouverture IndexedDB'));
  });
}

async function getAllFromLocalStore<T>(storeName: string, fallbackKey: string): Promise<T[]> {
  try {
    const idb = await openLocalDatabase();
    const items = await new Promise<T[]>((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    idb.close();
    return items;
  } catch {
    try {
      const raw = localStorage.getItem(fallbackKey);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }
}

async function putInLocalStore<T extends { id: string }>(
  storeName: string,
  fallbackKey: string,
  item: T
): Promise<void> {
  const normalized = { ...item, id: String(item.id) };
  try {
    const idb = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {
    const existing = await getAllFromLocalStore<T>(storeName, fallbackKey);
    const idx = existing.findIndex((entry) => String(entry.id) === normalized.id);
    if (idx >= 0) {
      existing[idx] = normalized;
    } else {
      existing.push(normalized);
    }
    try {
      localStorage.setItem(fallbackKey, JSON.stringify(existing));
    } catch {
      // ignore quota error on fallback
    }
  }
}

async function deleteFromLocalStore<T extends { id: string }>(
  storeName: string,
  fallbackKey: string,
  id: string
): Promise<void> {
  const strId = String(id);
  try {
    const idb = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(strId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {
    const existing = await getAllFromLocalStore<T>(storeName, fallbackKey);
    const filtered = existing.filter((entry) => String(entry.id) !== strId);
    try {
      localStorage.setItem(fallbackKey, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  }
}

async function replaceLocalStore<T extends { id: string }>(
  storeName: string,
  fallbackKey: string,
  items: T[]
): Promise<void> {
  const normalizedList = items
    .filter((i) => i && i.id)
    .map((i) => ({ ...i, id: String(i.id) }));
  try {
    const idb = await openLocalDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of normalizedList) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {
    try {
      localStorage.setItem(fallbackKey, JSON.stringify(normalizedList));
    } catch {
      // ignore
    }
  }
}

export function sortByDateDesc<T extends { date: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

export async function getAllLocalHunts(): Promise<Hunt[]> {
  const hunts = await getAllFromLocalStore<Hunt>(HUNTS_STORE, FALLBACK_HUNTS_KEY);
  return sortByDateDesc(hunts);
}

export async function getAllLocalTrophies(): Promise<Trophy[]> {
  const trophies = await getAllFromLocalStore<Trophy>(TROPHIES_STORE, FALLBACK_TROPHIES_KEY);
  return sortByDateDesc(trophies);
}

// ===============================================================
// Sérialisation Firestore (respect de la limite 1 Mo & pas de photos base64 lourdes)
// ===============================================================

interface UserSubdoc<T> {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  title: string;
  payload: T;
}

function requireDb() {
  if (!db) {
    throw new Error('Firestore n’est pas disponible hors-ligne.');
  }
  return db;
}

/**
 * Nettoie un objet pour Firestore : convertit les `undefined` en `null` (comme app-charcuterie).
 */
export function cleanForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_k, v) => (v === undefined ? null : v))
  ) as T;
}

function toFirestoreTimestamp(isoString?: string): Timestamp {
  if (isoString) {
    const ms = Date.parse(isoString);
    if (!Number.isNaN(ms)) {
      return Timestamp.fromMillis(ms);
    }
  }
  return Timestamp.now();
}

/**
 * Retire les photos base64 avant envoi vers Firestore (plan Spark sans Storage, limite 1 Mo/doc).
 * Les photos restent stockées en local dans IndexedDB et fusionnées à la réception des snapshots.
 */
function stripHuntPhotosForCloud(hunt: Hunt): Hunt {
  const normalized: Hunt = {
    ...hunt,
    id: String(hunt.id),
    photos: [],
  };
  return cleanForFirestore(normalized);
}

function stripTrophyPhotoForCloud(trophy: Trophy): Trophy {
  const { photo: _photo, ...rest } = trophy;
  const normalized = {
    ...rest,
    id: String(trophy.id),
  } as Trophy;
  return cleanForFirestore(normalized);
}

function toHuntSubdoc(hunt: Hunt): UserSubdoc<Hunt> {
  const title = `${hunt.date} — ${hunt.location || hunt.huntType}`.slice(0, 200);
  return {
    createdAt: toFirestoreTimestamp(hunt.createdAt),
    updatedAt: Timestamp.now(),
    title,
    payload: stripHuntPhotosForCloud(hunt),
  };
}

function toTrophySubdoc(trophy: Trophy): UserSubdoc<Trophy> {
  const title = `${trophy.title || trophy.species} (${trophy.date})`.slice(0, 200);
  return {
    createdAt: toFirestoreTimestamp(trophy.createdAt),
    updatedAt: Timestamp.now(),
    title,
    payload: stripTrophyPhotoForCloud(trophy),
  };
}

function fromSubdoc<T>(raw: unknown, docId: string): T | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const data =
    obj.payload && typeof obj.payload === 'object'
      ? (obj.payload as Record<string, unknown>)
      : obj;
  // Reconvertir les valeurs `null` optionnelles en `undefined` pour l'UI TypeScript
  const cleaned: Record<string, unknown> = { ...data, id: String(data.id || docId) };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === null) {
      delete cleaned[key];
    }
  }
  return cleaned as unknown as T;
}

function formatSyncError(err: unknown): string {
  const fbErr = err as { code?: string; message?: string };
  if (fbErr?.code === 'permission-denied') {
    return 'Accès Firestore refusé (vérifiez que votre e-mail est bien vérifié et autorisé).';
  }
  return fbErr?.message || 'Erreur de synchronisation Firestore';
}

// ===============================================================
// Push vers Firestore (writeBatch diff set + delete, lots <= 450, debounce 450 ms)
// ===============================================================

async function commitBatchedOps(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  if (ops.length === 0) return;
  const firestore = requireDb();
  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    for (const apply of chunk) {
      apply(batch);
    }
    await batch.commit();
  }
}

export async function syncAllUserDataToFirestore(): Promise<void> {
  const user = auth?.currentUser;
  if (!db || !user) return;
  const uid = user.uid;

  const [localHunts, localTrophies] = await Promise.all([
    getAllLocalHunts(),
    getAllLocalTrophies(),
  ]);

  const huntsColRef = collection(db, 'users', uid, HUNTS_COLLECTION);
  const trophiesColRef = collection(db, 'users', uid, TROPHIES_COLLECTION);

  const [existingHuntsSnap, existingTrophiesSnap] = await Promise.all([
    getDocs(huntsColRef),
    getDocs(trophiesColRef),
  ]);

  const currentHuntIds = new Set(
    localHunts.filter((h) => h && h.id).map((h) => String(h.id))
  );
  const currentTrophyIds = new Set(
    localTrophies.filter((t) => t && t.id).map((t) => String(t.id))
  );

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  existingHuntsSnap.docs.forEach((d) => {
    if (!currentHuntIds.has(d.id)) {
      ops.push((batch) => batch.delete(d.ref));
    }
  });
  localHunts.forEach((hunt) => {
    if (hunt && hunt.id) {
      const ref = doc(huntsColRef, String(hunt.id));
      const subdoc = toHuntSubdoc(hunt);
      ops.push((batch) => batch.set(ref, subdoc));
    }
  });

  existingTrophiesSnap.docs.forEach((d) => {
    if (!currentTrophyIds.has(d.id)) {
      ops.push((batch) => batch.delete(d.ref));
    }
  });
  localTrophies.forEach((trophy) => {
    if (trophy && trophy.id) {
      const ref = doc(trophiesColRef, String(trophy.id));
      const subdoc = toTrophySubdoc(trophy);
      ops.push((batch) => batch.set(ref, subdoc));
    }
  });

  await commitBatchedOps(ops);
}

export function planifierPushCloud(skipCloud = false): void {
  if (skipCloud || _suppressCloudSync || !estConnecteFirebase() || !cloudState.initialSyncDone) {
    return;
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
  }
  cloudState.syncStatus = 'syncing';
  cloudState.syncError = null;
  notifyCloudState();

  _syncTimer = setTimeout(async () => {
    try {
      await syncAllUserDataToFirestore();
      cloudState.syncStatus = 'synced';
      cloudState.lastSyncedAt = new Date().toISOString();
      notifyCloudState();
    } catch (err) {
      console.warn('Sync Firestore:', err);
      cloudState.syncStatus = 'error';
      cloudState.syncError = formatSyncError(err);
      notifyCloudState();
    }
  }, 450);
}

export async function forcerSyncCloud(): Promise<boolean> {
  if (!estConnecteFirebase()) {
    throw new Error('Non connecté au Cloud.');
  }
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  cloudState.syncStatus = 'syncing';
  cloudState.syncError = null;
  notifyCloudState();

  try {
    await syncAllUserDataToFirestore();
    cloudState.initialSyncDone = true;
    cloudState.syncStatus = 'synced';
    cloudState.lastSyncedAt = new Date().toISOString();
    const uid = auth?.currentUser?.uid;
    if (uid) {
      try {
        localStorage.setItem(LAST_UID_KEY, uid);
      } catch {
        // ignore
      }
    }
    notifyCloudState();
    return true;
  } catch (err) {
    const message = formatSyncError(err);
    cloudState.syncStatus = 'error';
    cloudState.syncError = message;
    notifyCloudState();
    throw new Error(message);
  }
}

// ===============================================================
// Synchronisation temps réel depuis Firestore (activerSyncCloud)
// ===============================================================

function mergeServerHuntsWithLocalPhotos(serverHunts: Hunt[], localHunts: Hunt[]): Hunt[] {
  const localById = new Map<string, Hunt>();
  localHunts.forEach((h) => {
    if (h && h.id) localById.set(String(h.id), h);
  });

  return serverHunts.map((sh) => {
    const local = localById.get(String(sh.id));
    const serverPhotos = Array.isArray(sh.photos) ? sh.photos : [];
    const localPhotos = local && Array.isArray(local.photos) ? local.photos : [];
    return {
      ...sh,
      id: String(sh.id),
      participants: Array.isArray(sh.participants) ? sh.participants : [],
      seenGame: Array.isArray(sh.seenGame) ? sh.seenGame : [],
      harvestedGame: Array.isArray(sh.harvestedGame) ? sh.harvestedGame : [],
      notes: typeof sh.notes === 'string' ? sh.notes : '',
      photos: serverPhotos.length > 0 ? serverPhotos : localPhotos,
    };
  });
}

function mergeServerTrophiesWithLocalPhotos(
  serverTrophies: Trophy[],
  localTrophies: Trophy[]
): Trophy[] {
  const localById = new Map<string, Trophy>();
  localTrophies.forEach((t) => {
    if (t && t.id) localById.set(String(t.id), t);
  });

  return serverTrophies.map((st) => {
    const local = localById.get(String(st.id));
    return {
      ...st,
      id: String(st.id),
      title: typeof st.title === 'string' ? st.title : st.species,
      location: typeof st.location === 'string' ? st.location : '',
      description: typeof st.description === 'string' ? st.description : '',
      photo: st.photo || local?.photo,
    };
  });
}

export function activerSyncCloud(callbacks: {
  onHuntsUpdated: (hunts: Hunt[]) => void;
  onTrophiesUpdated: (trophies: Trophy[]) => void;
}): void {
  arreterListenersFirestore();
  const user = auth?.currentUser;
  if (!db || !user) return;

  reinitialiserEtatCloud();
  cloudState.syncStatus = 'syncing';
  notifyCloudState();

  const currentUid = user.uid;
  let previousUid: string | null = null;
  try {
    previousUid = localStorage.getItem(LAST_UID_KEY);
  } catch {
    previousUid = null;
  }
  const isNewDeviceLogin = Boolean(currentUid && previousUid !== currentUid);
  let needsPushAfterInit = false;

  const checkInitComplete = () => {
    if (
      !cloudState.initialSyncDone &&
      Object.keys(cloudState.syncedCols).length >= 2
    ) {
      cloudState.initialSyncDone = true;
      cloudState.syncStatus = 'synced';
      cloudState.lastSyncedAt = new Date().toISOString();
      try {
        localStorage.setItem(LAST_UID_KEY, currentUid);
      } catch {
        // ignore
      }
      notifyCloudState();

      if (needsPushAfterInit) {
        needsPushAfterInit = false;
        planifierPushCloud(false);
      }
    }
  };

  const handleSyncError = (label: string, err: unknown) => {
    console.warn(`Sync ${label}:`, err);
    cloudState.syncStatus = 'error';
    cloudState.syncError = formatSyncError(err);
    notifyCloudState();
  };

  // 1. Listener temps réel sur chasse_hunts
  const unsubHunts = onSnapshot(
    collection(db, 'users', currentUid, HUNTS_COLLECTION),
    async (snap) => {
      const fromCache = snap.metadata.fromCache;
      const rawServerList = snap.docs
        .map((d) => fromSubdoc<Hunt>(d.data(), d.id))
        .filter((h): h is Hunt => h !== null);

      // Ne jamais traiter un cache local vide comme un serveur vide
      if (fromCache && rawServerList.length === 0) {
        return;
      }

      const localItems = await getAllLocalHunts();
      const serverListWithLocalPhotos = mergeServerHuntsWithLocalPhotos(
        rawServerList,
        localItems
      );
      const isFirstServerForCol = !fromCache && !cloudState.syncedCols[HUNTS_COLLECTION];

      if (isFirstServerForCol) {
        cloudState.syncedCols[HUNTS_COLLECTION] = true;

        if (serverListWithLocalPhotos.length === 0 && localItems.length > 0) {
          // Serveur réellement vide + local non vide -> pousser le local après init complète
          needsPushAfterInit = true;
          callbacks.onHuntsUpdated(sortByDateDesc(localItems));
        } else if (
          serverListWithLocalPhotos.length > 0 &&
          localItems.length > 0 &&
          isNewDeviceLogin
        ) {
          // Nouvel appareil / compte : fusion serveur + éléments locaux absents du serveur
          const serverIds = new Set(
            serverListWithLocalPhotos.map((i) => String(i.id))
          );
          const localOnly = localItems.filter(
            (i) => i && i.id && !serverIds.has(String(i.id))
          );
          const merged = sortByDateDesc([
            ...serverListWithLocalPhotos,
            ...localOnly,
          ]);
          _suppressCloudSync = true;
          await replaceLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, merged);
          _suppressCloudSync = false;
          callbacks.onHuntsUpdated(merged);
          if (localOnly.length > 0) {
            needsPushAfterInit = true;
          }
        } else {
          // Sinon le serveur remplace le local
          const sorted = sortByDateDesc(serverListWithLocalPhotos);
          _suppressCloudSync = true;
          await replaceLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, sorted);
          _suppressCloudSync = false;
          callbacks.onHuntsUpdated(sorted);
        }

        checkInitComplete();
      } else {
        const sorted = sortByDateDesc(serverListWithLocalPhotos);
        _suppressCloudSync = true;
        await replaceLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, sorted);
        _suppressCloudSync = false;
        callbacks.onHuntsUpdated(sorted);
      }
    },
    (err) => handleSyncError(HUNTS_COLLECTION, err)
  );
  _unsubListeners.push(unsubHunts);

  // 2. Listener temps réel sur chasse_trophies
  const unsubTrophies = onSnapshot(
    collection(db, 'users', currentUid, TROPHIES_COLLECTION),
    async (snap) => {
      const fromCache = snap.metadata.fromCache;
      const rawServerList = snap.docs
        .map((d) => fromSubdoc<Trophy>(d.data(), d.id))
        .filter((t): t is Trophy => t !== null);

      // Ne jamais traiter un cache local vide comme un serveur vide
      if (fromCache && rawServerList.length === 0) {
        return;
      }

      const localItems = await getAllLocalTrophies();
      const serverListWithLocalPhotos = mergeServerTrophiesWithLocalPhotos(
        rawServerList,
        localItems
      );
      const isFirstServerForCol =
        !fromCache && !cloudState.syncedCols[TROPHIES_COLLECTION];

      if (isFirstServerForCol) {
        cloudState.syncedCols[TROPHIES_COLLECTION] = true;

        if (serverListWithLocalPhotos.length === 0 && localItems.length > 0) {
          needsPushAfterInit = true;
          callbacks.onTrophiesUpdated(sortByDateDesc(localItems));
        } else if (
          serverListWithLocalPhotos.length > 0 &&
          localItems.length > 0 &&
          isNewDeviceLogin
        ) {
          const serverIds = new Set(
            serverListWithLocalPhotos.map((i) => String(i.id))
          );
          const localOnly = localItems.filter(
            (i) => i && i.id && !serverIds.has(String(i.id))
          );
          const merged = sortByDateDesc([
            ...serverListWithLocalPhotos,
            ...localOnly,
          ]);
          _suppressCloudSync = true;
          await replaceLocalStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, merged);
          _suppressCloudSync = false;
          callbacks.onTrophiesUpdated(merged);
          if (localOnly.length > 0) {
            needsPushAfterInit = true;
          }
        } else {
          const sorted = sortByDateDesc(serverListWithLocalPhotos);
          _suppressCloudSync = true;
          await replaceLocalStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, sorted);
          _suppressCloudSync = false;
          callbacks.onTrophiesUpdated(sorted);
        }

        checkInitComplete();
      } else {
        const sorted = sortByDateDesc(serverListWithLocalPhotos);
        _suppressCloudSync = true;
        await replaceLocalStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, sorted);
        _suppressCloudSync = false;
        callbacks.onTrophiesUpdated(sorted);
      }
    },
    (err) => handleSyncError(TROPHIES_COLLECTION, err)
  );
  _unsubListeners.push(unsubTrophies);
}

// ===============================================================
// Opérations CRUD Local-First (écrit en local puis planifie le push debounced 450 ms)
// ===============================================================

export async function saveHunt(hunt: Hunt): Promise<Hunt[]> {
  const normalized: Hunt = { ...hunt, id: String(hunt.id) };
  await putInLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, normalized);
  planifierPushCloud(false);
  return getAllLocalHunts();
}

export async function deleteHunt(id: string): Promise<Hunt[]> {
  await deleteFromLocalStore<Hunt>(HUNTS_STORE, FALLBACK_HUNTS_KEY, id);
  planifierPushCloud(false);
  return getAllLocalHunts();
}

export async function saveTrophy(trophy: Trophy): Promise<Trophy[]> {
  const normalized: Trophy = { ...trophy, id: String(trophy.id) };
  await putInLocalStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, normalized);
  planifierPushCloud(false);
  return getAllLocalTrophies();
}

export async function deleteTrophy(id: string): Promise<Trophy[]> {
  await deleteFromLocalStore<Trophy>(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, id);
  planifierPushCloud(false);
  return getAllLocalTrophies();
}

export async function replaceAllData(
  hunts: Hunt[],
  trophies: Trophy[]
): Promise<{ hunts: Hunt[]; trophies: Trophy[] }> {
  await Promise.all([
    replaceLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, hunts),
    replaceLocalStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, trophies),
  ]);
  planifierPushCloud(false);
  const [nextHunts, nextTrophies] = await Promise.all([
    getAllLocalHunts(),
    getAllLocalTrophies(),
  ]);
  return { hunts: nextHunts, trophies: nextTrophies };
}

export async function mergeData(
  hunts: Hunt[],
  trophies: Trophy[]
): Promise<{ hunts: Hunt[]; trophies: Trophy[] }> {
  const [existingHunts, existingTrophies] = await Promise.all([
    getAllLocalHunts(),
    getAllLocalTrophies(),
  ]);

  const huntsMap = new Map<string, Hunt>();
  existingHunts.forEach((h) => huntsMap.set(String(h.id), h));
  hunts.forEach((h) => {
    if (h && h.id) huntsMap.set(String(h.id), { ...h, id: String(h.id) });
  });

  const trophiesMap = new Map<string, Trophy>();
  existingTrophies.forEach((t) => trophiesMap.set(String(t.id), t));
  trophies.forEach((t) => {
    if (t && t.id) trophiesMap.set(String(t.id), { ...t, id: String(t.id) });
  });

  await Promise.all([
    replaceLocalStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, Array.from(huntsMap.values())),
    replaceLocalStore(
      TROPHIES_STORE,
      FALLBACK_TROPHIES_KEY,
      Array.from(trophiesMap.values())
    ),
  ]);
  planifierPushCloud(false);

  const [nextHunts, nextTrophies] = await Promise.all([
    getAllLocalHunts(),
    getAllLocalTrophies(),
  ]);
  return { hunts: nextHunts, trophies: nextTrophies };
}
