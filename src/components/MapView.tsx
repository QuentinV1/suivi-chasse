import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  Plus,
  Minus,
  Crosshair,
  WifiOff,
  Map as MapIcon,
  Award,
  Compass,
  Maximize2,
} from 'lucide-react';
import { GeoPoint, Hunt, Trophy } from '../types';
import { formatCoords, formatShortDateFr, haversineDistanceKm } from '../constants/game';

interface MapViewProps {
  hunts: Hunt[];
  trophies: Trophy[];
  focusPoint?: GeoPoint | null;
  onSelectHunt: (hunt: Hunt) => void;
  onSelectTrophy: (trophy: Trophy) => void;
  onCreateHuntAtCoords: (coords: GeoPoint) => void;
}

interface MapMarker {
  id: string;
  kind: 'hunt' | 'post' | 'trophy';
  title: string;
  subtitle: string;
  date: string;
  lat: number;
  lng: number;
  hunt?: Hunt;
  trophy?: Trophy;
}

const TILE_SIZE = 256;
const DEFAULT_CENTER = { lat: 46.603354, lng: 1.888334 }; // France center

function latLngToWorld(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((clampedLat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * scale;
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function getMetersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

export const MapView: React.FC<MapViewProps> = ({
  hunts,
  trophies,
  focusPoint,
  onSelectHunt,
  onSelectTrophy,
  onCreateHuntAtCoords,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 480 });
  const [center, setCenter] = useState<{ lat: number; lng: number }>(
    focusPoint ? { lat: focusPoint.lat, lng: focusPoint.lng } : DEFAULT_CENTER
  );
  const [zoom, setZoom] = useState<number>(focusPoint ? 14 : 6);
  const [offlineMode, setOfflineMode] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showHunts, setShowHunts] = useState(true);
  const [showPosts, setShowPosts] = useState(true);
  const [showTrophies, setShowTrophies] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [userGps, setUserGps] = useState<GeoPoint | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [isPlacingHunt, setIsPlacingHunt] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startWorldX: number;
    startWorldY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (focusPoint) {
      setCenter({ lat: focusPoint.lat, lng: focusPoint.lng });
      setZoom(14);
    }
  }, [focusPoint]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setSize({
        width: el.clientWidth || 800,
        height: el.clientHeight || 480,
      });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];

    if (showHunts) {
      hunts.forEach((hunt) => {
        if (hunt.coordinates) {
          list.push({
            id: `hunt-${hunt.id}`,
            kind: 'hunt',
            title: hunt.location,
            subtitle: `${hunt.huntType} • ${formatShortDateFr(hunt.date)}`,
            date: hunt.date,
            lat: hunt.coordinates.lat,
            lng: hunt.coordinates.lng,
            hunt,
          });
        }
      });
    }

    if (showPosts) {
      hunts.forEach((hunt) => {
        hunt.posts?.forEach((post) => {
          list.push({
            id: `post-${hunt.id}-${post.id}`,
            kind: 'post',
            title: post.name,
            subtitle: `Poste • ${hunt.location} (${formatShortDateFr(hunt.date)})`,
            date: hunt.date,
            lat: post.lat,
            lng: post.lng,
            hunt,
          });
        });
      });
    }

    if (showTrophies) {
      trophies.forEach((trophy) => {
        if (trophy.coordinates) {
          list.push({
            id: `trophy-${trophy.id}`,
            kind: 'trophy',
            title: trophy.title || trophy.species,
            subtitle: `Trophée ${trophy.species} • ${formatShortDateFr(trophy.date)}`,
            date: trophy.date,
            lat: trophy.coordinates.lat,
            lng: trophy.coordinates.lng,
            trophy,
          });
        }
      });
    }

    return list;
  }, [hunts, trophies, showHunts, showPosts, showTrophies]);

  const fitAllMarkers = () => {
    if (markers.length === 0) {
      setCenter(DEFAULT_CENTER);
      setZoom(6);
      return;
    }
    const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
    setCenter({ lat: avgLat, lng: avgLng });
    setZoom(markers.length === 1 ? 14 : 11);
  };

  useEffect(() => {
    if (!focusPoint && markers.length > 0) {
      const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
      const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
      setCenter({ lat: avgLat, lng: avgLng });
      setZoom(markers.length === 1 ? 14 : 10);
    }
    // Only auto-fit on initial mount when no focusPoint
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS indisponible sur cet appareil.');
      return;
    }
    setGpsStatus('Recherche GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: GeoPoint = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        setUserGps(pt);
        setCenter({ lat: pt.lat, lng: pt.lng });
        setZoom((z) => Math.max(z, 14));
        setGpsStatus(`Position GPS (±${pt.accuracy} m)`);
      },
      () => {
        setGpsStatus('Impossible d’obtenir la position GPS.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const centerWorld = latLngToWorld(center.lat, center.lng, zoom);
  const topLeftWorld = {
    x: centerWorld.x - size.width / 2,
    y: centerWorld.y - size.height / 2,
  };

  const tiles = useMemo(() => {
    if (offlineMode) return [];
    const maxTile = Math.pow(2, zoom);
    const startX = Math.floor(topLeftWorld.x / TILE_SIZE);
    const endX = Math.floor((topLeftWorld.x + size.width) / TILE_SIZE);
    const startY = Math.floor(topLeftWorld.y / TILE_SIZE);
    const endY = Math.floor((topLeftWorld.y + size.height) / TILE_SIZE);

    const list: { key: string; x: number; y: number; left: number; top: number; url: string }[] = [];
    for (let tx = startX; tx <= endX; tx++) {
      for (let ty = startY; ty <= endY; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        list.push({
          key: `${zoom}-${tx}-${ty}`,
          x: tx,
          y: ty,
          left: tx * TILE_SIZE - topLeftWorld.x,
          top: ty * TILE_SIZE - topLeftWorld.y,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        });
      }
    }
    return list;
  }, [offlineMode, zoom, topLeftWorld.x, topLeftWorld.y, size.width, size.height]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const world = latLngToWorld(center.lat, center.lng, zoom);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startWorldX: world.x,
      startWorldY: world.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current?.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const nextCenter = worldToLatLng(
      dragRef.current.startWorldX - dx,
      dragRef.current.startWorldY - dy,
      zoom
    );
    setCenter(nextCenter);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const wasMoved = dragRef.current.moved;
    dragRef.current = null;

    if (!wasMoved && isPlacingHunt && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const clicked = worldToLatLng(topLeftWorld.x + px, topLeftWorld.y + py, zoom);
      setIsPlacingHunt(false);
      onCreateHuntAtCoords({
        lat: Number(clicked.lat.toFixed(6)),
        lng: Number(clicked.lng.toFixed(6)),
      });
    }
  };

  const metersPerPx = getMetersPerPixel(center.lat, zoom);
  const scaleBarMeters = Math.round(metersPerPx * 90);
  const scaleLabel =
    scaleBarMeters >= 1000
      ? `${(scaleBarMeters / 1000).toFixed(1)} km`
      : `${scaleBarMeters} m`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-earth-200 bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHunts((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              showHunts
                ? 'border-forest-600 bg-forest-50 text-forest-800'
                : 'border-earth-300 bg-white text-earth-600'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            Sorties ({hunts.filter((h) => h.coordinates).length})
          </button>

          <button
            type="button"
            onClick={() => setShowPosts((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              showPosts
                ? 'border-copper-600 bg-copper-500/10 text-copper-600'
                : 'border-earth-300 bg-white text-earth-600'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            Postes ({hunts.reduce((s, h) => s + (h.posts?.length ?? 0), 0)})
          </button>

          <button
            type="button"
            onClick={() => setShowTrophies((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              showTrophies
                ? 'border-amber-600 bg-amber-50 text-amber-800'
                : 'border-earth-300 bg-white text-earth-600'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Trophées ({trophies.filter((t) => t.coordinates).length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOfflineMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              offlineMode
                ? 'border-amber-600 bg-amber-50 text-amber-900'
                : 'border-earth-300 bg-earth-50 text-earth-800 hover:bg-earth-100'
            }`}
            title="Basculer entre carte OpenStreetMap et grille topographique hors-ligne"
          >
            {offlineMode ? <WifiOff className="h-3.5 w-3.5" /> : <MapIcon className="h-3.5 w-3.5" />}
            {offlineMode ? 'Mode Hors-ligne Terrain' : 'Carte en ligne'}
          </button>

          <button
            type="button"
            onClick={() => setIsPlacingHunt((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              isPlacingHunt
                ? 'bg-copper-600 text-white shadow-sm'
                : 'border border-earth-300 bg-white text-forest-900 hover:bg-earth-50'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            {isPlacingHunt ? 'Cliquez sur la carte...' : 'Placer une sortie'}
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 1 : -1;
          setZoom((z) => Math.max(3, Math.min(18, z + delta)));
        }}
        className={`relative h-[460px] w-full select-none overflow-hidden rounded-2xl border border-earth-300 shadow-inner touch-none ${
          isPlacingHunt ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        } ${offlineMode ? 'bg-[#e8ece2]' : 'bg-earth-100'}`}
      >
        {/* Online OSM Tiles */}
        {!offlineMode &&
          tiles.map((t) => (
            <img
              key={t.key}
              src={t.url}
              alt=""
              draggable={false}
              onError={() => setOfflineMode(true)}
              style={{
                position: 'absolute',
                left: t.left,
                top: t.top,
                width: TILE_SIZE,
                height: TILE_SIZE,
              }}
              className="pointer-events-none select-none"
            />
          ))}

        {/* Offline Topographic Grid */}
        {offlineMode && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <pattern
                id="topo-grid"
                width="48"
                height="48"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 48 0 L 0 0 0 48"
                  fill="none"
                  stroke="#94a889"
                  strokeWidth="0.7"
                  strokeOpacity="0.45"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#topo-grid)" />
          </svg>
        )}

        {/* User GPS Marker */}
        {userGps && (() => {
          const w = latLngToWorld(userGps.lat, userGps.lng, zoom);
          const x = w.x - topLeftWorld.x;
          const y = w.y - topLeftWorld.y;
          return (
            <div
              style={{ left: x, top: y }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 shadow-md">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
            </div>
          );
        })()}

        {/* Data Markers */}
        {markers.map((marker) => {
          const w = latLngToWorld(marker.lat, marker.lng, zoom);
          const x = w.x - topLeftWorld.x;
          const y = w.y - topLeftWorld.y;
          if (x < -40 || y < -40 || x > size.width + 40 || y > size.height + 40) {
            return null;
          }

          const colorClass =
            marker.kind === 'hunt'
              ? 'bg-forest-700 text-white border-white'
              : marker.kind === 'post'
              ? 'bg-copper-600 text-white border-white'
              : 'bg-amber-500 text-forest-950 border-white';

          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => setSelectedMarker(marker)}
              style={{ left: x, top: y }}
              title={marker.title}
              className={`absolute -translate-x-1/2 -translate-y-full rounded-full border-2 p-1.5 shadow-md transition hover:scale-110 ${colorClass}`}
            >
              {marker.kind === 'trophy' ? (
                <Award className="h-3.5 w-3.5" />
              ) : marker.kind === 'post' ? (
                <Navigation className="h-3.5 w-3.5" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
            </button>
          );
        })}

        {/* Map Controls (Right) */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(18, z + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-earth-300 bg-white/95 text-forest-950 shadow-sm hover:bg-white"
            aria-label="Zoom avant"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(3, z - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-earth-300 bg-white/95 text-forest-950 shadow-sm hover:bg-white"
            aria-label="Zoom arrière"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-earth-300 bg-white/95 text-forest-700 shadow-sm hover:bg-white"
            title="Centrer sur ma position GPS"
            aria-label="Ma position GPS"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={fitAllMarkers}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-earth-300 bg-white/95 text-earth-800 shadow-sm hover:bg-white"
            title="Tout cadrer"
            aria-label="Tout cadrer"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Scale & Coords Overlay */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-xl border border-earth-300/80 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-forest-950 backdrop-blur-sm">
          <span>N ↑</span>
          <span className="h-3 w-px bg-earth-300" />
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-16 border-b-2 border-l-2 border-r-2 border-forest-900" />
            {scaleLabel}
          </span>
          <span className="h-3 w-px bg-earth-300" />
          <span>{formatCoords(center.lat, center.lng)}</span>
        </div>

        {gpsStatus && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-earth-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-forest-900 shadow-sm">
            {gpsStatus}
          </div>
        )}
      </div>

      {/* Selected Marker Card */}
      {selectedMarker && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-forest-950">{selectedMarker.title}</p>
            <p className="text-xs text-earth-700">{selectedMarker.subtitle}</p>
            <p className="mt-1 text-[11px] text-earth-600">
              GPS : {formatCoords(selectedMarker.lat, selectedMarker.lng)}
              {userGps && (
                <span className="ml-2 font-semibold text-forest-800">
                  • à {haversineDistanceKm(userGps, selectedMarker).toFixed(2)} km
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedMarker.hunt && (
              <button
                type="button"
                onClick={() => onSelectHunt(selectedMarker.hunt!)}
                className="rounded-xl bg-forest-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-forest-800"
              >
                Voir la sortie
              </button>
            )}
            {selectedMarker.trophy && (
              <button
                type="button"
                onClick={() => onSelectTrophy(selectedMarker.trophy!)}
                className="rounded-xl bg-copper-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-copper-500"
              >
                Voir le trophée
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedMarker(null)}
              className="rounded-xl border border-earth-300 px-3 py-2 text-xs font-medium text-earth-800 hover:bg-earth-100"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {markers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-earth-300 bg-white/80 p-5 text-center text-xs text-earth-700">
          Aucun lieu ou poste géolocalisé pour le moment. Utilisez le bouton{' '}
          <strong>« Placer une sortie »</strong> sur la carte ou activez la{' '}
          <strong>position GPS</strong> dans une sortie ou un trophée.
        </div>
      )}
    </div>
  );
};
