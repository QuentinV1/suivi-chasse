import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  X,
  Cloud,
  RefreshCw,
  LogOut,
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  Shield,
} from 'lucide-react';
import { auth, db, googleProvider, isFirebaseConfigured } from '../lib/firebase';
import { resolveUserAccess, type AccessStatus } from '../lib/accessControl';
import { AccessControlPanel } from './AccessControlPanel';
import {
  arreterListenersFirestore,
  forcerSyncCloud,
  reinitialiserEtatCloud,
  type CloudState,
} from '../utils/db';

interface CloudModalProps {
  user: User | null;
  cloudState: CloudState;
  totalItemsCount: number;
  onClose: () => void;
  onRestartSync: () => void;
  onUserReloaded: (user: User | null) => void;
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

export const AuthScreen: React.FC<CloudModalProps> = ({
  user,
  cloudState,
  totalItemsCount,
  onClose,
  onRestartSync,
  onUserReloaded,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncActionError, setSyncActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isResendingVerif, setIsResendingVerif] = useState(false);
  const [isCheckingVerif, setIsCheckingVerif] = useState(false);
  const [unverifiedMsg, setUnverifiedMsg] = useState<string>(
    'Vérifiez votre boîte mail (ou utilisez « Continuer avec Google »).'
  );
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'account' | 'access'>('account');

  useEffect(() => {
    if (!user || !user.emailVerified) {
      setAccessStatus(null);
      setActiveTab('account');
      return;
    }
    let cancelled = false;
    resolveUserAccess(db, 'suivi-chasse', user.email)
      .then((status) => {
        if (!cancelled) {
          setAccessStatus(status);
          if (!status.isAdmin) {
            setActiveTab('account');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccessStatus(null);
          setActiveTab('account');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, user?.email, user?.emailVerified]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        if (cred.user) {
          sendEmailVerification(cred.user).catch(() => {});
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
      onClose();
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
      onClose();
    } catch (err) {
      setAuthError(getFriendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceSync = async () => {
    setSyncActionError(null);
    setIsForceSyncing(true);
    try {
      await forcerSyncCloud();
    } catch (err) {
      setSyncActionError(
        err instanceof Error ? err.message : 'Impossible de synchroniser.'
      );
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleSignOut = async () => {
    if (!window.confirm('Se déconnecter du compte Cloud ?')) return;
    arreterListenersFirestore();
    if (auth) {
      await signOut(auth);
    }
    reinitialiserEtatCloud();
    onClose();
  };

  const handleResendVerification = async () => {
    if (!auth?.currentUser) return;
    setIsResendingVerif(true);
    try {
      if (auth.currentUser.emailVerified) {
        setUnverifiedMsg('Votre adresse est déjà vérifiée.');
      } else {
        await sendEmailVerification(auth.currentUser);
        setUnverifiedMsg(
          'E-mail de vérification envoyé ! Vérifiez votre boîte de réception (et les spams), puis cliquez sur « J\'ai vérifié ».'
        );
      }
    } catch (err) {
      setUnverifiedMsg(
        err instanceof Error
          ? err.message
          : 'Impossible d\'envoyer l\'e-mail de vérification.'
      );
    } finally {
      setIsResendingVerif(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!auth?.currentUser) return;
    setIsCheckingVerif(true);
    try {
      await auth.currentUser.reload();
      const refreshed = auth.currentUser;
      onUserReloaded(refreshed);
      if (refreshed?.emailVerified) {
        await refreshed.getIdToken(true);
        onRestartSync();
      } else {
        setUnverifiedMsg(
          'Adresse toujours non vérifiée. Cliquez d\'abord sur le lien reçu par e-mail.'
        );
      }
    } catch (err) {
      setUnverifiedMsg(
        err instanceof Error ? err.message : 'Erreur lors de la vérification.'
      );
    } finally {
      setIsCheckingVerif(false);
    }
  };

  const getSyncStatusDisplay = () => {
    if (cloudState.syncStatus === 'syncing') {
      return {
        text: 'Synchronisation en cours…',
        colorClass: 'text-amber-700',
      };
    }
    if (cloudState.syncStatus === 'error') {
      return {
        text: 'Erreur de synchronisation',
        colorClass: 'text-red-700',
      };
    }
    if (cloudState.initialSyncDone || cloudState.syncStatus === 'synced') {
      return {
        text: `Synchronisé (${totalItemsCount} élément${totalItemsCount > 1 ? 's' : ''})`,
        colorClass: 'text-forest-700',
      };
    }
    return {
      text: 'Connexion au Cloud…',
      colorClass: 'text-earth-600',
    };
  };

  const statusDisplay = getSyncStatusDisplay();
  const effectiveSyncError = syncActionError || cloudState.syncError;

  return (
    <div
      id="modal-auth"
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/60 p-3 backdrop-blur-sm sm:p-6"
    >
      <div
        className={`flex max-h-[90vh] max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl ${
          activeTab === 'access' ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-earth-200 bg-forest-900 px-4 py-3.5 text-white sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Cloud className="h-5 w-5 shrink-0 text-earth-300" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Compte Cloud Carnet de Chasse</h2>
              <p className="text-xs text-forest-200">
                Synchronisation Firestore (quentin-apps-hub)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-forest-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          {!user ? (
            /* Formulaire de connexion (déconnecté) */
            <div id="auth-logged-out-panel" className="space-y-4">
              <p className="text-xs leading-relaxed text-earth-700">
                Connectez-vous pour synchroniser vos sorties de chasse et votre album
                trophées entre tous vos appareils. Vos données restent stockées en local
                et accessibles hors-ligne.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-forest-900">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                    <input
                      id="auth-email"
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
                      id="auth-password"
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
                <div
                  id="auth-error-msg"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
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
          ) : (
            /* Panneau compte connecté */
            <div id="auth-logged-in-panel" className="space-y-3.5">
              {accessStatus && !accessStatus.hasAppAccess && (
                <div
                  id="auth-unauthorized-banner"
                  className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    Votre compte n&apos;est pas autorisé sur cette application. Contactez un
                    administrateur.
                  </span>
                </div>
              )}

              {accessStatus?.isAdmin && (
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-earth-200 bg-earth-100/70 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('account')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === 'account'
                        ? 'bg-white text-forest-950 shadow-sm'
                        : 'text-earth-700 hover:text-forest-950'
                    }`}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    Compte Cloud
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('access')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      activeTab === 'access'
                        ? 'bg-white text-forest-950 shadow-sm'
                        : 'text-earth-700 hover:text-forest-950'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Accès &amp; Rôles
                  </button>
                </div>
              )}

              {accessStatus?.isAdmin && activeTab === 'access' ? (
                <div className="rounded-xl bg-slate-900 p-3">
                  <AccessControlPanel
                    db={db}
                    user={user}
                    appId="suivi-chasse"
                    appName="Suivi Chasse"
                    theme="dark"
                  />
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-earth-200 bg-earth-50/70 p-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-earth-600">
                  Connecté en tant que
                </div>
                <div
                  id="auth-connected-email"
                  className="mt-0.5 break-all text-sm font-bold text-forest-950"
                >
                  {user.email || user.displayName || user.uid}
                </div>
                <div
                  id="auth-sync-status"
                  className={`mt-1.5 text-xs font-semibold ${statusDisplay.colorClass}`}
                >
                  {statusDisplay.text}
                </div>
              </div>

              {effectiveSyncError && (
                <div
                  id="auth-sync-error-msg"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{effectiveSyncError}</span>
                </div>
              )}

              {!user.emailVerified && (
                <div
                  id="auth-unverified-box"
                  className="rounded-xl border border-amber-400/50 bg-amber-50/90 p-3.5 text-xs"
                >
                  <div className="mb-1 font-bold text-amber-900">
                    Adresse e-mail non vérifiée
                  </div>
                  <div id="auth-unverified-msg" className="mb-2.5 text-amber-800">
                    {unverifiedMsg}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      id="btn-resend-verif"
                      type="button"
                      disabled={isResendingVerif}
                      onClick={() => void handleResendVerification()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                    >
                      {isResendingVerif && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Renvoyer l'e-mail de vérification
                    </button>
                    <button
                      id="btn-check-verif"
                      type="button"
                      disabled={isCheckingVerif}
                      onClick={() => void handleCheckVerification()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-forest-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-forest-900 disabled:opacity-60"
                    >
                      {isCheckingVerif && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      J'ai vérifié
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  id="btn-force-sync"
                  type="button"
                  disabled={isForceSyncing}
                  onClick={() => void handleForceSync()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-900 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isForceSyncing ? 'animate-spin' : ''}`}
                  />
                  Synchroniser maintenant
                </button>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Se déconnecter
                </button>
              </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
