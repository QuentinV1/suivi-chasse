import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import {
  AlertCircle,
  BarChart3,
  Camera,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Trees,
  UserPlus,
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
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

  const highlights = [
    {
      icon: BarChart3,
      title: 'Carnet & Statistiques',
      desc: 'Consigne tes sorties, gibier vu/tué et analyse tes saisons.',
    },
    {
      icon: Camera,
      title: 'Album trophées & Partage',
      desc: 'Photos compressées, mensurations et partage WhatsApp / SMS.',
    },
    {
      icon: MapPin,
      title: 'Carte & Postes GPS',
      desc: 'Repère tes postes et zones de chasse même sans réseau.',
    },
  ];

  return (
    <div
      id="access-gate-wall"
      className="fixed inset-0 z-50 flex min-h-full items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-100 via-emerald-50/40 to-slate-100 p-4 sm:p-6"
    >
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl lg:grid-cols-12">
        {/* Panneau éditorial */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-stone-950 via-emerald-950 to-green-900 p-7 text-white lg:col-span-6 lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <Trees className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-tight">Carnet de Chasse</p>
                <p className="text-xs text-emerald-100/80">Sorties &amp; Album trophées</p>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                Consigne tes sorties, territoires et trophées sur le terrain.
              </h1>
              <p className="text-sm text-emerald-100/80">
                Synchronisé en temps réel sur tous tes appareils et accessible hors-ligne en forêt.
              </p>
            </div>

            <div className="hidden space-y-3 pt-2 lg:block">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 backdrop-blur-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-4 w-4 text-emerald-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-emerald-100/80">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 hidden items-center gap-2 text-xs text-emerald-100/70 lg:flex">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Mode terrain hors-ligne inclus</span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-6 lg:p-10">
          {gate.phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-800" />
              <p className="text-sm text-slate-600">
                Vérification de votre session et de vos autorisations…
              </p>
            </div>
          )}

          {gate.phase === 'unauthenticated' && (
            <div id="access-gate-login">
              <div className="mb-6 space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {mode === 'login' ? 'Connexion à ton espace' : 'Créer ton compte'}
                </h2>
                <p className="text-sm text-slate-500">
                  Utilise ton compte autorisé pour retrouver ton carnet de chasse synchronisé.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleGoogleAuth()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
                >
                  <LogIn className="h-4 w-4" />
                  Continuer avec Google
                </button>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>ou par e-mail</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleEmailAuth(mode === 'register');
                  }}
                  className="space-y-3"
                >
                  <input
                    id="gate-auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="adresse@email.com"
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  />

                  <input
                    id="gate-auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe (6+ caractères)"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                  />

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === 'register' ? (
                      <UserPlus className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {mode === 'register' ? 'Créer un compte' : 'Se connecter par e-mail'}
                  </button>
                </form>

                <button
                  type="button"
                  className="w-full cursor-pointer pt-1 text-center text-xs font-medium text-slate-500 hover:text-emerald-800"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setAuthError(null);
                  }}
                >
                  {mode === 'login'
                    ? 'Pas encore de compte ? Créer un compte'
                    : 'Déjà inscrit ? Se connecter'}
                </button>

                {authError && (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    <span>{authError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {gate.phase === 'unauthorized' && (
            <div id="access-gate-unauthorized" className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
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
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSignOutClick()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
