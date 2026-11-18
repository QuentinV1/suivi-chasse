import React, { useState } from 'react';
import { Plus, Trash2, Minus } from 'lucide-react';
import { GameSpeciesCount } from '../types';
import { COMMON_SPECIES } from '../constants/game';

interface SpeciesListEditorProps {
  label: string;
  items: GameSpeciesCount[];
  onChange: (items: GameSpeciesCount[]) => void;
  accent?: 'forest' | 'copper';
  emptyText?: string;
}

export const SpeciesListEditor: React.FC<SpeciesListEditorProps> = ({
  label,
  items,
  onChange,
  accent = 'forest',
  emptyText = 'Aucune espèce ajoutée.',
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<string>(COMMON_SPECIES[0]);
  const [customSpecies, setCustomSpecies] = useState<string>('');
  const [count, setCount] = useState<number>(1);

  const handleAdd = () => {
    const speciesName =
      selectedSpecies === 'Autre' ? customSpecies.trim() : selectedSpecies.trim();
    if (!speciesName) return;

    const safeCount = Math.max(1, Math.floor(count || 1));
    const existingIndex = items.findIndex(
      (item) => item.species.toLowerCase() === speciesName.toLowerCase()
    );

    if (existingIndex >= 0) {
      const updated = items.map((item, idx) =>
        idx === existingIndex ? { ...item, count: item.count + safeCount } : item
      );
      onChange(updated);
    } else {
      onChange([...items, { species: speciesName, count: safeCount }]);
    }

    setCount(1);
    if (selectedSpecies === 'Autre') {
      setCustomSpecies('');
    }
  };

  const handleUpdateCount = (index: number, delta: number) => {
    const updated = items
      .map((item, idx) =>
        idx === index ? { ...item, count: Math.max(0, item.count + delta) } : item
      )
      .filter((item) => item.count > 0);
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, idx) => idx !== index));
  };

  const badgeStyle =
    accent === 'copper'
      ? 'bg-copper-500/10 text-copper-600 border-copper-500/25'
      : 'bg-forest-100 text-forest-800 border-forest-200';

  const btnStyle =
    accent === 'copper'
      ? 'bg-copper-500 hover:bg-copper-600 text-white'
      : 'bg-forest-700 hover:bg-forest-800 text-white';

  return (
    <div className="space-y-3 rounded-xl border border-earth-200 bg-earth-50/70 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-forest-900">{label}</span>
        <span className="text-xs font-medium text-earth-700">
          Total : {items.reduce((acc, i) => acc + i.count, 0)}
        </span>
      </div>

      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedSpecies}
          onChange={(e) => setSelectedSpecies(e.target.value)}
          className="min-w-[140px] flex-1 rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-sm text-forest-950 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
        >
          {COMMON_SPECIES.map((sp) => (
            <option key={sp} value={sp}>
              {sp}
            </option>
          ))}
        </select>

        {selectedSpecies === 'Autre' && (
          <input
            type="text"
            value={customSpecies}
            onChange={(e) => setCustomSpecies(e.target.value)}
            placeholder="Nom de l'espèce..."
            className="min-w-[130px] flex-1 rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-sm text-forest-950 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
          />
        )}

        <div className="flex items-center rounded-lg border border-earth-300 bg-white">
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            className="px-2 py-1.5 text-earth-700 hover:text-forest-950"
            aria-label="Diminuer la quantité"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-11 border-x border-earth-200 py-1 text-center text-sm font-medium text-forest-950 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCount((c) => c + 1)}
            className="px-2 py-1.5 text-earth-700 hover:text-forest-950"
            aria-label="Augmenter la quantité"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${btnStyle}`}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {/* Existing items */}
      {items.length === 0 ? (
        <p className="text-xs italic text-earth-600">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <div
              key={`${item.species}-${idx}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${badgeStyle}`}
            >
              <span>{item.species}</span>
              <span className="font-bold">×{item.count}</span>
              <div className="ml-1 flex items-center gap-0.5 border-l border-current/20 pl-1">
                <button
                  type="button"
                  onClick={() => handleUpdateCount(idx, -1)}
                  className="rounded p-0.5 hover:bg-black/10"
                  title="Retirer 1"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateCount(idx, 1)}
                  className="rounded p-0.5 hover:bg-black/10"
                  title="Ajouter 1"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="rounded p-0.5 text-red-700 hover:bg-red-500/15"
                  title="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
