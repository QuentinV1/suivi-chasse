import React, { useEffect, useState } from 'react';
import {
  X,
  Share2,
  MessageCircle,
  MessageSquare,
  Copy,
  Download,
  Check,
  Send,
} from 'lucide-react';
import { Trophy } from '../types';
import {
  buildTrophyShareText,
  canUseNativeShare,
  copyTextToClipboard,
  downloadTrophyPhoto,
  getSmsShareUrl,
  getWhatsAppShareUrl,
  shareTrophyNative,
} from '../utils/share';

interface ShareTrophyModalProps {
  trophy: Trophy;
  onClose: () => void;
}

export const ShareTrophyModal: React.FC<ShareTrophyModalProps> = ({
  trophy,
  onClose,
}) => {
  const [message, setMessage] = useState<string>(() => buildTrophyShareText(trophy));
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const nativeSupported = canUseNativeShare();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleNativeShare = async () => {
    setIsSharing(true);
    setStatusNotice(null);
    const result = await shareTrophyNative(trophy, message);
    setIsSharing(false);

    if (result === 'shared') {
      setStatusNotice('Trophée partagé avec succès.');
    } else if (result === 'unsupported') {
      setStatusNotice(
        'Le partage natif avec fichier n’est pas disponible sur ce navigateur. Utilisez WhatsApp, SMS ou Copier/Télécharger ci-dessous.'
      );
    }
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setStatusNotice('Impossible de copier automatiquement dans le presse-papiers.');
    }
  };

  const handleMessengerFallback = async () => {
    await copyTextToClipboard(message);
    if (trophy.photo) {
      downloadTrophyPhoto(trophy);
    }
    setCopied(true);
    setStatusNotice(
      trophy.photo
        ? 'Texte copié et photo téléchargée — collez-les dans Messenger !'
        : 'Texte copié — collez-le dans Messenger !'
    );
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-950/75 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-earth-200 bg-forest-900 px-4 py-3.5 text-white sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Share2 className="h-5 w-5 shrink-0 text-earth-300" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Partager le trophée</h2>
              <p className="text-xs text-forest-200">
                Photo &amp; description vers WhatsApp, Messenger ou SMS
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

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {trophy.photo && (
            <div className="flex items-center gap-3 rounded-xl border border-earth-200 bg-earth-50/70 p-2.5">
              <img
                src={trophy.photo}
                alt={trophy.title || trophy.species}
                className="h-16 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-forest-950">
                  {trophy.title || trophy.species}
                </p>
                <p className="text-xs text-earth-600">
                  Photo prête pour le partage
                </p>
              </div>
              <button
                type="button"
                onClick={() => downloadTrophyPhoto(trophy)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-xs font-medium text-earth-800 transition hover:bg-earth-100"
                title="Enregistrer la photo"
              >
                <Download className="h-3.5 w-3.5" />
                Photo
              </button>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-earth-700">
                Message descriptif
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-forest-600" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copier le texte
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1500}
              className="w-full rounded-xl border border-earth-300 bg-earth-50/40 p-3 text-sm text-forest-950 focus:border-forest-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          {statusNotice && (
            <div className="rounded-xl border border-forest-200 bg-forest-50 px-3.5 py-2.5 text-xs text-forest-900">
              {statusNotice}
            </div>
          )}

          {/* Primary Native Share (mobile: WhatsApp, Messenger, SMS with photo) */}
          {nativeSupported && (
            <button
              type="button"
              disabled={isSharing}
              onClick={handleNativeShare}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest-800 disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {trophy.photo
                ? 'Partager photo + texte (WhatsApp, Messenger, SMS...)'
                : 'Partager via une application'}
            </button>
          )}

          {/* Direct App Shortcuts */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a
              href={getWhatsAppShareUrl(message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>

            <button
              type="button"
              onClick={handleMessengerFallback}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
              title="Copie le texte et télécharge la photo pour Messenger"
            >
              <Send className="h-4 w-4" />
              Messenger
            </button>

            <a
              href={getSmsShareUrl(message)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-earth-300 bg-earth-100 px-3 py-2.5 text-sm font-semibold text-earth-900 transition hover:bg-earth-200"
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </a>
          </div>

          {!nativeSupported && trophy.photo && (
            <p className="text-[11px] leading-relaxed text-earth-600">
              Astuce : sur ordinateur, les liens directs WhatsApp/SMS envoient le texte.
              Téléchargez la photo pour la joindre à votre message, ou utilisez un téléphone
              pour envoyer photo + texte en un clic.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
