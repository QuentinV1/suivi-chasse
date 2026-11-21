import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Download,
  Upload,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LayoutGrid,
  ExternalLink,
} from 'lucide-react';
import { BackupPayload, Hunt, Trophy } from '../types';
import { formatBytes } from '../utils/image';

function isValidHunt(item: unknown): item is Hunt {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.date === 'string' &&
    typeof obj.location === 'string' &&
    Array.isArray(obj.seenGame) &&
    Array.isArray(obj.harvestedGame)
  );
}

function isValidTrophy(item: unknown): item is Trophy {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.species === 'string' &&
    typeof obj.date === 'string'
  );
}

interface BackupModalProps {
  hunts: Hunt[];
  trophies: Trophy[];
  onImport: (hunts: Hunt[], trophies: Trophy[], mode: 'replace' | 'merge') => Promise<void>;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  hunts,
  trophies,
  onImport,
  onClose,
}) => {
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showOtherApps, setShowOtherApps] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showOtherApps) {
          setShowOtherApps(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showOtherApps]);

  const estimatedStorage = useMemo(() => {
    const json = JSON.stringify({ hunts, trophies });
    return formatBytes(new Blob([json]).size);
  }, [hunts, trophies]);

  const handleExport = () => {
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      hunts,
      trophies,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi-chasse-sauvegarde-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);
    setPendingPayload(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;

      if (
        !parsed ||
        !Array.isArray(parsed.hunts) ||
        !Array.isArray(parsed.trophies)
      ) {
        throw new Error(
          'Format de fichier invalide. Le JSON doit contenir les tableaux "hunts" et "trophies".'
        );
      }

      const validHunts = parsed.hunts.filter(isValidHunt).map((h) => ({
        ...h,
        participants: Array.isArray(h.participants) ? h.participants : [],
        photos: Array.isArray(h.photos) ? h.photos : [],
        notes: typeof h.notes === 'string' ? h.notes : '',
      }));
      const validTrophies = parsed.trophies.filter(isValidTrophy).map((t) => ({
        ...t,
        title: typeof t.title === 'string' ? t.title : t.species,
        location: typeof t.location === 'string' ? t.location : '',
        description: typeof t.description === 'string' ? t.description : '',
      }));

      setPendingPayload({
        version: 1,
        exportedAt: parsed.exportedAt ?? new Date().toISOString(),
        hunts: validHunts,
        trophies: validTrophies,
      });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Impossible de lire le fichier JSON.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const confirmImport = async (mode: 'replace' | 'merge') => {
    if (!pendingPayload) return;
    setIsImporting(true);
    setImportError(null);

    try {
      await onImport(pendingPayload.hunts, pendingPayload.trophies, mode);
      setImportSuccess(
        mode === 'replace'
          ? `Sauvegarde restaurée (${pendingPayload.hunts.length} sorties, ${pendingPayload.trophies.length} trophées).`
          : `Données fusionnées avec succès.`
      );
      setPendingPayload(null);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Erreur lors de l’importation.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-earth-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-earth-200 bg-forest-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <HardDrive className="h-5 w-5 text-earth-300" />
            <div>
              <h2 className="text-lg font-semibold">Sauvegarde &amp; Portabilité</h2>
              <p className="text-xs text-forest-200">
                Stockage 100 % local (IndexedDB) + Export/Import JSON
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-forest-200 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {/* Storage summary */}
          <div className="rounded-xl border border-earth-200 bg-earth-50/70 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-earth-800">Volume local utilisé</span>
              <span className="font-bold text-forest-900">{estimatedStorage}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-earth-600">
              <span>{hunts.length} sortie(s) de chasse</span>
              <span>{trophies.length} trophée(s)</span>
            </div>
          </div>

          {/* Export */}
          <div className="space-y-2 rounded-xl border border-forest-200 bg-forest-50/50 p-4">
            <h3 className="text-sm font-semibold text-forest-950">
              Exporter une sauvegarde complète
            </h3>
            <p className="text-xs leading-relaxed text-earth-700">
              Télécharge un fichier JSON contenant toutes vos sorties, vos trophées et
              vos photos compressées.
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-800"
            >
              <Download className="h-4 w-4" />
              Télécharger la sauvegarde (.json)
            </button>
          </div>

          {/* Import */}
          <div className="space-y-3 rounded-xl border border-earth-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-forest-950">
              Importer une sauvegarde JSON
            </h3>
            <p className="text-xs leading-relaxed text-earth-700">
              Restaurez un fichier précédemment exporté pour retrouver vos données sur
              cet appareil.
            </p>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-earth-300 bg-earth-50/60 px-4 py-3 text-sm font-medium text-forest-800 transition hover:border-forest-500 hover:bg-forest-50/60">
              <Upload className="h-4 w-4" />
              Sélectionner un fichier .json
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {importError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="flex items-start gap-2 rounded-xl border border-forest-200 bg-forest-50 p-3 text-xs text-forest-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            {pendingPayload && (
              <div className="space-y-3 rounded-xl border border-earth-300 bg-earth-50 p-3.5">
                <p className="text-xs font-medium text-forest-950">
                  Fichier prêt : <strong>{pendingPayload.hunts.length}</strong> sortie(s) et{' '}
                  <strong>{pendingPayload.trophies.length}</strong> trophée(s).
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => confirmImport('merge')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-forest-600 bg-white px-3 py-2 text-xs font-semibold text-forest-800 transition hover:bg-forest-50 disabled:opacity-50"
                  >
                    {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Fusionner (ajouter)
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => confirmImport('replace')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-copper-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-copper-500 disabled:opacity-50"
                  >
                    {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Tout remplacer
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-earth-200 bg-earth-50/60 p-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-forest-950">Mes autres applications</h3>
              <p className="text-xs text-forest-600">
                Accéder rapidement aux autres applications web (GitHub Pages).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOtherApps(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-forest-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-forest-800"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Ouvrir
            </button>
          </div>
        </div>
      </div>

      {showOtherApps && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowOtherApps(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-earth-200 px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-bold text-forest-950">
                <LayoutGrid className="h-4 w-4 text-forest-700" />
                Mes autres applications
              </h3>
              <button
                type="button"
                onClick={() => setShowOtherApps(false)}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-forest-500 hover:bg-earth-100 hover:text-forest-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
              <p className="text-xs text-forest-600">
                Retrouvez toutes les autres applications hébergées sur GitHub Pages.
              </p>
              <div className="grid gap-2">
                {[
                  { name: "L'Affinoir", desc: "Charcuterie, salaisons & cave d'affinage", url: 'https://quentinv1.github.io/app-charcuterie/' },
                  { name: 'Pêche France', desc: 'Réglementation, mailles, cartes & carnet de prises', url: 'https://quentinv1.github.io/app-peche/' },
                  { name: 'App Voyage', desc: "Planificateur d'itinéraire, carte & carnet de voyage", url: 'https://quentinv1.github.io/app-voyage/' },
                  { name: 'Budget Prévisionnel', desc: 'Budget du foyer, provisions & projections', url: 'https://quentinv1.github.io/budget-previsionnel/' },
                  { name: 'Cave à vin', desc: 'Stock de bouteilles, apogée & dégustations', url: 'https://quentinv1.github.io/cave-a-vin/' },
                  { name: 'Checklist Valise', desc: 'Bagages, calculateur de poids & règles IATA', url: 'https://quentinv1.github.io/checklist-valise/' },
                  { name: 'Livre de recettes', desc: 'Recettes, planning semaine & liste de courses', url: 'https://quentinv1.github.io/livre-recettes/' },
                  { name: 'Travaux Maison', desc: 'Plan 2D/3D, courses, tâches & entretien', url: 'https://quentinv1.github.io/travaux-maison/' },
                ].map((app) => (
                  <a
                    key={app.url}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-earth-200 bg-earth-50/50 px-3.5 py-2.5 transition hover:border-forest-300 hover:bg-forest-50/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-forest-950">{app.name}</div>
                      <div className="truncate text-xs text-forest-600">{app.desc}</div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-forest-700">
                      Ouvrir <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
            <div className="flex justify-end border-t border-earth-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setShowOtherApps(false)}
                className="rounded-lg border border-earth-300 bg-white px-4 py-2 text-xs font-semibold text-forest-800 hover:bg-earth-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
