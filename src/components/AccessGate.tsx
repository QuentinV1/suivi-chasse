import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldAlert,
  Trees,
  WifiOff,
} from 'lucide-react';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import type { AccessStatus } from '../lib/accessControl';

export type AccessGateState =
  | { phase: 'loading' }
  | { phase: 'unauthenticated' }
  | { phase: 'authorized'; status: AccessStatus; offline: boolean }
  | { phase: 'unauthorized'; email: string }
  | { phase: 'offline_unverified'; email: string };

interface AccessGateProps {
  gate: AccessGateState;
  user: User | null;
  onRetryVerification: () => void;
  onSignOut: () => Promise<void>;
}

function getFriendlyAuthError(err: unknown): string {
  const fbErr = err as { code?: string; message?: string };
  switch (fbErr?.code) {
    case 'auth/invalid-email':
      return 'Adresse e-mail invalide.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cette adresse e-mail.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
    case 'auth/popup-closed-by-user':
      return 'Connexion Google annulée.';
    case 'auth/popup-blocked':
      return 'La fenêtre Google a été bloquée par votre navigateur. Autorisez les popups pour ce site.';
    case 'auth/unauthorized-domain':
      return 'Ce domaine n’est pas autorisé dans la console Firebase.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion Internet.';
    default:
      return fbErr?.message || 'Erreur de connexion.';
  }
}

export const AccessGate: React.FC<AccessGateProps> = ({
  gate,
  user,
  onRetryVerification,
  onSignOut,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (gate.phase === 'authorized') return null;

  const handleEmailAuth = async (isRegister: boolean) => {
    setAuthError(null);
    if (!isFirebaseConfigured || !auth) {
      setAuthError('Firebase indisponible hors-ligne.');
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError('Veuillez renseigner votre e-mail et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setAuthError(getFriendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError('Firebase indisponible hors-ligne.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(getFriendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOutClick = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await onSignOut();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="access-gate-wall"
      className="fixed inset-0 z-50 flex items-center justify-center bg-earth-100 p-4 text-forest-950"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-earth-200 bg-forest-900 px-5 py-4 text-white">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-earth-400/30 bg-forest-800/80 text-earth-200">
            <Trees className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Carnet de Chasse</h1>
            <p className="text-xs text-forest-200">Accès sécurisé &amp; Synchronisation</p>
          </div>
        </div>

        <div className="p-5">
          {gate.phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-forest-700" />
              <p className="text-sm text-earth-700">
                Vérification de votre session et de vos autorisations…
              </p>
            </div>
          )}

          {gate.phase === 'unauthenticated' && (
            <div id="access-gate-login" className="space-y-4">
              <p className="text-xs leading-relaxed text-earth-700">
                Connexion requise pour accéder à votre carnet de chasse. Connectez-vous
                une première fois en ligne pour activer l&apos;utilisation hors-ligne en
                forêt.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-forest-900">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                    <input
                      id="gate-auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="prenom@exemple.fr"
                      autoComplete="email"
                      className="w-full rounded-xl border border-earth-200 bg-earth-50/50 py-2.5 pl-9 pr-3 text-sm text-forest-950 outline-none transition focus:border-forest-600 focus:bg-white focus:ring-2 focus:ring-forest-600/15"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-forest-900">
                    Mot de passe (6 car. min)
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                    <input
                      id="gate-auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleEmailAuth(false);
                        }
                      }}
                      className="w-full rounded-xl border border-earth-200 bg-earth-50/50 py-2.5 pl-9 pr-3 text-sm text-forest-950 outline-none transition focus:border-forest-600 focus:bg-white focus:ring-2 focus:ring-forest-600/15"
                    />
                  </div>
                </div>
              </div>

              {authError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleEmailAuth(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-900 disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Se connecter
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleEmailAuth(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-earth-300 bg-earth-100 px-4 py-2.5 text-sm font-semibold text-forest-950 transition hover:bg-earth-200 disabled:opacity-60"
                >
                  Créer un compte
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleGoogleAuth()}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-earth-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-950 shadow-sm transition hover:bg-earth-50 disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>Continuer avec Google</span>
                </button>
              </div>
            </div>
          )}

          {gate.phase === 'unauthorized' && (
            <div id="access-gate-unauthorized" className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-red-900">Accès non autorisé</div>
                  <p className="leading-relaxed">
                    Le compte <strong className="break-all">{user?.email || gate.email}</strong>{' '}
                    n&apos;est pas autorisé sur cette application. Contactez un
                    administrateur.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSignOutClick()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter / Changer de compte
              </button>
            </div>
          )}

          {gate.phase === 'offline_unverified' && (
            <div id="access-gate-offline" className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-xs text-amber-900">
                <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div className="space-y-1">
                  <div className="text-sm font-bold">
                    Connexion Internet requise pour vérifier vos autorisations
                  </div>
                  <p className="leading-relaxed text-amber-800">
                    Aucune autorisation hors-ligne valide n&apos;a été trouvée pour{' '}
                    <strong className="break-all">{user?.email || gate.email}</strong>.
                    Connectez-vous à Internet pour valider votre accès.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onRetryVerification}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-900 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSignOutClick()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter / Changer de compte
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
