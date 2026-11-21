import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export const FIREBASE_CONFIG = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    'AIzaSyCuYM0tMpd1f1jDYz27OhCaPpcAWhI3i48',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    'quentin-apps-hub.firebaseapp.com',
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || 'quentin-apps-hub',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'quentin-apps-hub.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '249016348389',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:249016348389:web:16a04a526cbe46c59cee0c',
};

export const isFirebaseConfigured = Boolean(
  FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId &&
    typeof window !== 'undefined' &&
    window.location.protocol !== 'file:'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    const alreadyInitialized = getApps().length > 0;
    app = alreadyInitialized ? getApp() : initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    if (alreadyInitialized) {
      db = getFirestore(app);
    } else {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
          ignoreUndefinedProperties: true,
        });
      } catch {
        db = getFirestore(app);
      }
    }
  } catch (err) {
    console.warn('Firebase SDK indisponible (mode hors-ligne local):', err);
    app = null;
    auth = null;
    db = null;
    googleProvider = null;
  }
}

export { app, auth, db, googleProvider };
