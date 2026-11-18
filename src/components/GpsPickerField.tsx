import React, { useState } from 'react';
import { Crosshair, Loader2, MapPin, Trash2 } from 'lucide-react';
import { GeoPoint } from '../types';
import { formatCoords } from '../constants/game';

interface GpsPickerFieldProps {
  value?: GeoPoint;
  onChange: (coords: GeoPoint | undefined) => void;
  label?: string;
}

export const GpsPickerField: React.FC<GpsPickerFieldProps> = ({
  value,
  onChange,
  label = 'Géolocalisation GPS (optionnel)',
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [latInput, setLatInput] = useState(value ? String(value.lat) : '');
  const [lngInput, setLngInput] = useState(value ? String(value.lng) : '');

  const handleUseCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('La géolocalisation n’est pas disponible sur cet appareil.');
      return;
    }

    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: GeoPoint = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        onChange(next);
        setLatInput(String(next.lat));
        setLngInput(String(next.lng));
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Autorisation GPS refusée. Vous pouvez saisir les coordonnées manuellement.');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('Délai GPS dépassé. Réessayez en terrain dégagé ou saisissez manuellement.');
        } else {
          setGeoError('Position GPS indisponible pour le moment.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  };

  const applyManualCoords = () => {
    const lat = Number(latInput.replace(',', '.').trim());
    const lng = Number(lngInput.replace(',', '.').trim());
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setGeoError('Coordonnées invalides (latitude -90..90, longitude -180..180).');
      return;
    }
    setGeoError(null);
    onChange({
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
    });
    setManualOpen(false);
  };

  return (
    <div className="rounded-xl border border-earth-200 bg-earth-50/50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-earth-700">
          <MapPin className="h-3.5 w-3.5 text-forest-700" />
          {label}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={isLocating}
            onClick={handleUseCurrentGps}
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest-700 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Ma position GPS
          </button>

          <button
            type="button"
            onClick={() => {
              setManualOpen((prev) => !prev);
              if (value) {
                setLatInput(String(value.lat));
                setLngInput(String(value.lng));
              }
            }}
            className="rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-xs font-medium text-earth-800 transition hover:bg-earth-100"
          >
            Saisir
          </button>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setLatInput('');
                setLngInput('');
                setGeoError(null);
              }}
              className="rounded-lg p-1.5 text-earth-600 transition hover:bg-red-50 hover:text-red-700"
              title="Effacer la position"
              aria-label="Effacer la position"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {value && (
        <p className="mt-2 text-xs text-forest-900">
          Position enregistrée : <strong>{formatCoords(value.lat, value.lng)}</strong>
          {value.accuracy !== undefined && (
            <span className="ml-1.5 text-earth-600">(±{value.accuracy} m)</span>
          )}
        </p>
      )}

      {geoError && (
        <p className="mt-2 text-xs text-red-700">{geoError}</p>
      )}

      {manualOpen && (
        <div className="mt-2.5 flex flex-wrap items-end gap-2 border-t border-earth-200 pt-2.5">
          <div className="flex-1 min-w-[110px]">
            <label className="mb-1 block text-[11px] font-medium text-earth-700">
              Latitude
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="ex: 46.23456"
              className="w-full rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-xs text-forest-950 focus:border-forest-600 focus:outline-none"
            />
          </div>
          <div className="flex-1 min-w-[110px]">
            <label className="mb-1 block text-[11px] font-medium text-earth-700">
              Longitude
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              placeholder="ex: 2.34567"
              className="w-full rounded-lg border border-earth-300 bg-white px-2.5 py-1.5 text-xs text-forest-950 focus:border-forest-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={applyManualCoords}
            className="rounded-lg bg-copper-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-copper-500"
          >
            Valider
          </button>
        </div>
      )}
    </div>
  );
};
