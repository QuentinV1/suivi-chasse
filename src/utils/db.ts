import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Hunt, Trophy } from '../types';

const HUNTS_COLLECTION = 'hunts';
const TROPHIES_COLLECTION = 'trophies';

// Legacy local storage constants (used to offer one-click migration of pre-auth data)
const LEGACY_DB_NAME = 'suivi-chasse-db';
const LEGACY_DB_VERSION = 1;
const LEGACY_FALLBACK_HUNTS_KEY = 'suivi_chasse_hunts_fallback_v1';
const LEGACY_FALLBACK_TROPHIES_KEY = 'suivi_chasse_trophies_fallback_v1';

function requireDb() {
  if (!db) {
    throw new Error('Firestore n’est pas configuré.');
  }
  return db;
}

/**
 * Recursively removes keys with `undefined` values because Firestore rejects `undefined`.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = stripUndefined(v);
      }
    }
    return cleaned as T;
  }
  return value;
}

function sortByDateDesc<T extends { date: string; createdAt: string }>(items: T[]): T[] {
  return items.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
}

function userHuntsCollection(userId: string) {
  return collection(requireDb(), 'users', userId, HUNTS_COLLECTION);
}

function userTrophiesCollection(userId: string) {
  return collection(requireDb(), 'users', userId, TROPHIES_COLLECTION);
}

export function subscribeToHunts(
  userId: string,
  onData: (hunts: Hunt[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    userHuntsCollection(userId),
    (snapshot) => {
      const hunts = snapshot.docs.map((d) => d.data() as Hunt);
      onData(sortByDateDesc(hunts));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeToTrophies(
  userId: string,
  onData: (trophies: Trophy[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    userTrophiesCollection(userId),
    (snapshot) => {
      const trophies = snapshot.docs.map((d) => d.data() as Trophy);
      onData(sortByDateDesc(trophies));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function getAllHunts(userId: string): Promise<Hunt[]> {
  const snapshot = await getDocs(userHuntsCollection(userId));
  const hunts = snapshot.docs.map((d) => d.data() as Hunt);
  return sortByDateDesc(hunts);
}

export async function saveHunt(userId: string, hunt: Hunt): Promise<void> {
  const ref = doc(requireDb(), 'users', userId, HUNTS_COLLECTION, hunt.id);
  await setDoc(ref, stripUndefined(hunt));
}

export async function deleteHunt(userId: string, id: string): Promise<void> {
  const ref = doc(requireDb(), 'users', userId, HUNTS_COLLECTION, id);
  await deleteDoc(ref);
}

export async function getAllTrophies(userId: string): Promise<Trophy[]> {
  const snapshot = await getDocs(userTrophiesCollection(userId));
  const trophies = snapshot.docs.map((d) => d.data() as Trophy);
  return sortByDateDesc(trophies);
}

export async function saveTrophy(userId: string, trophy: Trophy): Promise<void> {
  const ref = doc(requireDb(), 'users', userId, TROPHIES_COLLECTION, trophy.id);
  await setDoc(ref, stripUndefined(trophy));
}

export async function deleteTrophy(userId: string, id: string): Promise<void> {
  const ref = doc(requireDb(), 'users', userId, TROPHIES_COLLECTION, id);
  await deleteDoc(ref);
}

async function commitBatchedOps(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  const firestore = requireDb();
  const CHUNK_SIZE = 450; // Stay safely under Firestore's 500 operations per batch limit
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(firestore);
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    for (const apply of chunk) {
      apply(batch);
    }
    await batch.commit();
  }
}

export async function replaceAllData(
  userId: string,
  hunts: Hunt[],
  trophies: Trophy[]
): Promise<void> {
  const firestore = requireDb();
  const [existingHuntsSnap, existingTrophiesSnap] = await Promise.all([
    getDocs(userHuntsCollection(userId)),
    getDocs(userTrophiesCollection(userId)),
  ]);

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const d of existingHuntsSnap.docs) {
    ops.push((batch) => batch.delete(d.ref));
  }
  for (const d of existingTrophiesSnap.docs) {
    ops.push((batch) => batch.delete(d.ref));
  }
  for (const hunt of hunts) {
    const ref = doc(firestore, 'users', userId, HUNTS_COLLECTION, hunt.id);
    ops.push((batch) => batch.set(ref, stripUndefined(hunt)));
  }
  for (const trophy of trophies) {
    const ref = doc(firestore, 'users', userId, TROPHIES_COLLECTION, trophy.id);
    ops.push((batch) => batch.set(ref, stripUndefined(trophy)));
  }

  await commitBatchedOps(ops);
}

export async function mergeData(
  userId: string,
  hunts: Hunt[],
  trophies: Trophy[]
): Promise<void> {
  const firestore = requireDb();
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const hunt of hunts) {
    const ref = doc(firestore, 'users', userId, HUNTS_COLLECTION, hunt.id);
    ops.push((batch) => batch.set(ref, stripUndefined(hunt), { merge: true }));
  }
  for (const trophy of trophies) {
    const ref = doc(firestore, 'users', userId, TROPHIES_COLLECTION, trophy.id);
    ops.push((batch) => batch.set(ref, stripUndefined(trophy), { merge: true }));
  }

  await commitBatchedOps(ops);
}

// --- Legacy local IndexedDB / localStorage helpers for pre-auth data migration ---

function openLegacyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const request = indexedDB.open(LEGACY_DB_NAME, LEGACY_DB_VERSION);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(HUNTS_COLLECTION)) {
        idb.createObjectStore(HUNTS_COLLECTION, { keyPath: 'id' });
      }
      if (!idb.objectStoreNames.contains(TROPHIES_COLLECTION)) {
        idb.createObjectStore(TROPHIES_COLLECTION, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLegacyStore<T>(storeName: string, fallbackKey: string): Promise<T[]> {
  try {
    const idb = await openLegacyDatabase();
    const items = await new Promise<T[]>((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
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

export async function getLegacyLocalData(): Promise<{
  hunts: Hunt[];
  trophies: Trophy[];
}> {
  const [hunts, trophies] = await Promise.all([
    readLegacyStore<Hunt>(HUNTS_COLLECTION, LEGACY_FALLBACK_HUNTS_KEY),
    readLegacyStore<Trophy>(TROPHIES_COLLECTION, LEGACY_FALLBACK_TROPHIES_KEY),
  ]);
  return { hunts, trophies };
}

export async function clearLegacyLocalData(): Promise<void> {
  try {
    const idb = await openLegacyDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction([HUNTS_COLLECTION, TROPHIES_COLLECTION], 'readwrite');
      tx.objectStore(HUNTS_COLLECTION).clear();
      tx.objectStore(TROPHIES_COLLECTION).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    idb.close();
  } catch {
    // Ignore IndexedDB errors
  }
  try {
    localStorage.removeItem(LEGACY_FALLBACK_HUNTS_KEY);
    localStorage.removeItem(LEGACY_FALLBACK_TROPHIES_KEY);
  } catch {
    // Ignore localStorage errors
  }
}
