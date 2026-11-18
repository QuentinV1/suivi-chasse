import { Hunt, Trophy } from '../types';

const DB_NAME = 'suivi-chasse-db';
const DB_VERSION = 1;
const HUNTS_STORE = 'hunts';
const TROPHIES_STORE = 'trophies';

const FALLBACK_HUNTS_KEY = 'suivi_chasse_hunts_fallback_v1';
const FALLBACK_TROPHIES_KEY = 'suivi_chasse_trophies_fallback_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HUNTS_STORE)) {
        db.createObjectStore(HUNTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TROPHIES_STORE)) {
        db.createObjectStore(TROPHIES_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erreur ouverture IndexedDB'));
  });
}

async function getAllFromStore<T>(storeName: string, fallbackKey: string): Promise<T[]> {
  try {
    const db = await openDatabase();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      const raw = localStorage.getItem(fallbackKey);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  }
}

async function putInStore<T extends { id: string }>(
  storeName: string,
  fallbackKey: string,
  item: T
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllFromStore<T>(storeName, fallbackKey);
    const idx = existing.findIndex((entry) => entry.id === item.id);
    if (idx >= 0) {
      existing[idx] = item;
    } else {
      existing.push(item);
    }
    localStorage.setItem(fallbackKey, JSON.stringify(existing));
  }
}

async function deleteFromStore<T extends { id: string }>(
  storeName: string,
  fallbackKey: string,
  id: string
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllFromStore<T>(storeName, fallbackKey);
    const filtered = existing.filter((entry) => entry.id !== id);
    localStorage.setItem(fallbackKey, JSON.stringify(filtered));
  }
}

export async function getAllHunts(): Promise<Hunt[]> {
  const hunts = await getAllFromStore<Hunt>(HUNTS_STORE, FALLBACK_HUNTS_KEY);
  return hunts.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function saveHunt(hunt: Hunt): Promise<void> {
  await putInStore(HUNTS_STORE, FALLBACK_HUNTS_KEY, hunt);
}

export async function deleteHunt(id: string): Promise<void> {
  await deleteFromStore<Hunt>(HUNTS_STORE, FALLBACK_HUNTS_KEY, id);
}

export async function getAllTrophies(): Promise<Trophy[]> {
  const trophies = await getAllFromStore<Trophy>(TROPHIES_STORE, FALLBACK_TROPHIES_KEY);
  return trophies.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );
}

export async function saveTrophy(trophy: Trophy): Promise<void> {
  await putInStore(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, trophy);
}

export async function deleteTrophy(id: string): Promise<void> {
  await deleteFromStore<Trophy>(TROPHIES_STORE, FALLBACK_TROPHIES_KEY, id);
}

export async function replaceAllData(hunts: Hunt[], trophies: Trophy[]): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([HUNTS_STORE, TROPHIES_STORE], 'readwrite');
      const huntStore = tx.objectStore(HUNTS_STORE);
      const trophyStore = tx.objectStore(TROPHIES_STORE);

      huntStore.clear();
      trophyStore.clear();

      for (const hunt of hunts) {
        huntStore.put(hunt);
      }
      for (const trophy of trophies) {
        trophyStore.put(trophy);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(FALLBACK_HUNTS_KEY, JSON.stringify(hunts));
    localStorage.setItem(FALLBACK_TROPHIES_KEY, JSON.stringify(trophies));
  }
}
