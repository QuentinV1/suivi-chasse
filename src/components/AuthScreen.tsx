import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  Trees,
  Mail,
  Lock,
  User as UserIcon,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

type AuthMode = 'login' | 'register' | 'reset';

function getFriendlyAuthError(code?: string): string {
  switch (code) {
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
      return 'Ce domaine n’est pas autorisé dans la console Firebase (Authentication > Settings > Authorized domains).';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez votre connexion Internet.';
    default:
      return 'Une erreur est survenue lors de l’authentification.';
  }
}

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isFirebaseConfigured || !auth || !googleProvider) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-earth-50 px-4 py-10 text-forest-950">
        <div className="w-full max-w-lg rounded-2xl border border-earth-200 bg-white p-6 shadow-lg sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-900 text-earth-100">
              <Trees className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-forest-950">Carnet de Chasse</h1>
              <p className="text-xs text-earth-600">Configuration Firebase requise</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Variables d’environnement manquantes</p>
            <p className="mt-1 text-xs leading-relaxed">
              Renseignez vos clés Firebase dans un fichier{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.local</code> (voir{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env.example</code>) ou
              dans les secrets GitHub Actions pour activer la connexion utilisateur et Firestore :
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 font-mono text-xs">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
              <li>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    try {
      const trimmedEmail = email.trim();
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const trimmedName = displayName.trim();
        if (trimmedName) {
          await updateProfile(cred.user, { displayName: trimmedName });
        }
      } else {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfo(
          'Un e-mail de réinitialisation vient d’être envoyé si un compte correspond à cette adresse.'
        );
      }
    } catch (err) {
      const firebaseErr = err as { code?: string };
      setError(getFriendlyAuthError(firebaseErr.code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return;
    setError(null);
    setInfo(null);
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const firebaseErr = err as { code?: string };
      setError(getFriendlyAuthError(firebaseErr.code));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const busy = isSubmitting || isGoogleLoading;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-forest-950 via-forest-900 to-earth-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-earth-200/80 bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-950 via-forest-900 to-forest-800 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-earth-400/30 bg-forest-800/80 text-earth-200 shadow-inner">
              <Trees className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-earth-50">
                Carnet de Chasse
              </h1>
              <p className="text-xs text-forest-200">
                Suivi des sorties &amp; Album trophées synchronisés
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Tabs */}
          {mode !== 'reset' && (
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-earth-100 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
                  mode === 'login'
                    ? 'bg-white text-forest-950 shadow-sm'
                    : 'text-earth-700 hover:text-forest-950'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-lg py-2 text-xs font-semibold transition sm:text-sm ${
                  mode === 'register'
                    ? 'bg-white text-forest-950 shadow-sm'
                    : 'text-earth-700 hover:text-forest-950'
                }`}
              >
                Créer un compte
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-4">
              <h2 className="text-base font-bold text-forest-950">
                Réinitialiser le mot de passe
              </h2>
              <p className="mt-1 text-xs text-earth-600">
                Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-forest-900">
                  Nom / Pseudo (optionnel)
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Quentin"
                    autoComplete="name"
                    className="w-full rounded-xl border border-earth-200 bg-earth-50/50 py-2.5 pl-9 pr-3 text-sm text-forest-950 outline-none transition focus:border-forest-600 focus:bg-white focus:ring-2 focus:ring-forest-600/15"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-forest-900">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  autoComplete="email"
                  className="w-full rounded-xl border border-earth-200 bg-earth-50/50 py-2.5 pl-9 pr-3 text-sm text-forest-950 outline-none transition focus:border-forest-600 focus:bg-white focus:ring-2 focus:ring-forest-600/15"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-forest-900">
                    Mot de passe
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-forest-700 hover:text-forest-900 hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-earth-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-xl border border-earth-200 bg-earth-50/50 py-2.5 pl-9 pr-3 text-sm text-forest-950 outline-none transition focus:border-forest-600 focus:bg-white focus:ring-2 focus:ring-forest-600/15"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="h-4 w-4" />
              ) : mode === 'register' ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              <span>
                {mode === 'login'
                  ? 'Se connecter'
                  : mode === 'register'
                    ? 'Créer mon carnet'
                    : 'Envoyer le lien'}
              </span>
            </button>
          </form>

          {mode === 'reset' ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mt-4 w-full text-center text-xs font-medium text-forest-700 hover:underline"
            >
              Retour à la connexion
            </button>
          ) : (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-earth-200" />
                <span className="text-xs font-medium text-earth-500">ou</span>
                <div className="h-px flex-1 bg-earth-200" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-earth-200 bg-white px-4 py-2.5 text-sm font-semibold text-forest-950 shadow-sm transition hover:bg-earth-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGoogleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-forest-700" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span>Continuer avec Google</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
