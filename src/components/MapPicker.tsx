import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Search,
  Layers,
  RotateCcw,
  Check,
  MapPin,
  MousePointerClick,
  Mountain,
  Globe2,
  Undo2,
  Navigation,
  Pencil,
  Crosshair
} from 'lucide-react';
import { BoundaryShape, BoundaryType } from '../types';

interface MapPickerProps {
  mode: BoundaryType;
  shape: BoundaryShape | null;
  onChange: (shape: BoundaryShape | null) => void;
  circleRadius: number;
  onClear: () => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  mode,
  shape,
  onChange,
  circleRadius,
  onClear,
  defaultCenter = [51.1657, 10.4515],
  defaultZoom = 6
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [tileType, setTileType] = useState<'osm' | 'satellite' | 'terrain'>('osm');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [isLocating, setIsLocating] = useState(false);

  // Fix default marker icons in Leaflet
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconShadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // Initialize Leaflet Map instance (Starts totally clean - NO preset shape)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter as L.LatLngTuple,
      zoom: defaultZoom,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: false, // disable so double click can be used to finish polygon
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    const timers = [
      setTimeout(() => map.invalidateSize(), 60),
      setTimeout(() => map.invalidateSize(), 300),
    ];

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(mapContainerRef.current);
    }

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      timers.forEach(clearTimeout);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Handle Tile Layer switching
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (tileType === 'osm') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors & European Cadastres',
        maxZoom: 19,
      }).addTo(map);
    } else if (tileType === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Satellite Imagery &copy; Esri, Maxar, Earthstar Geographics',
        maxZoom: 18,
      }).addTo(map);
    } else if (tileType === 'terrain') {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Topography & Relief: &copy; OpenTopoMap',
        maxZoom: 17,
      }).addTo(map);
    }
  }, [tileType]);

  // Handle center / country updates from parent (only pans map view, never creates preset shape)
  const prevDefaultCenterRef = useRef(defaultCenter);
  useEffect(() => {
    if (
      mapRef.current &&
      (prevDefaultCenterRef.current[0] !== defaultCenter[0] ||
        prevDefaultCenterRef.current[1] !== defaultCenter[1])
    ) {
      prevDefaultCenterRef.current = defaultCenter;
      mapRef.current.setView(defaultCenter as L.LatLngTuple, defaultZoom || 14);
    }
  }, [defaultCenter, defaultZoom]);

  // Finish polygon drawing
  const finishPolygon = useCallback(() => {
    if (drawingPoints.length >= 3) {
      onChange({
        type: 'polygon',
        points: [...drawingPoints]
      });
      setDrawingPoints([]);
    }
  }, [drawingPoints, onChange]);

  // Undo last placed point
  const undoLastPoint = useCallback(() => {
    if (drawingPoints.length > 0) {
      setDrawingPoints(prev => prev.slice(0, -1));
    }
  }, [drawingPoints]);

  // Reset / Clear everything
  const handleReset = useCallback(() => {
    setDrawingPoints([]);
    onClear();
  }, [onClear]);

  // Geolocation trigger (pans map to user's location)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 17);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation failed:', err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Map Click & Double Click Handling
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const latLng: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (mode === 'circle') {
        onChange({
          type: 'circle',
          center: latLng,
          radius: circleRadius
        });
        return;
      }

      if (mode === 'rectangle') {
        if (drawingPoints.length === 0) {
          setDrawingPoints([latLng]);
        } else {
          const corner1 = drawingPoints[0];
          const corner2 = latLng;
          setDrawingPoints([]);
          onChange({
            type: 'rectangle',
            corners: [corner1, corner2]
          });
        }
        return;
      }

      // Polygon Mode
      if (mode === 'polygon') {
        // If polygon is already completed, user can start fresh or use reset button
        if (shape && shape.type === 'polygon' && drawingPoints.length === 0) {
          // If clicking while completed, start a fresh new polygon from this click
          onChange(null);
          setDrawingPoints([latLng]);
          return;
        }

        // If clicking near first point with >= 3 points, close it!
        if (drawingPoints.length >= 3) {
          const first = drawingPoints[0];
          const dist = map.distance(L.latLng(latLng[0], latLng[1]), L.latLng(first[0], first[1]));
          if (dist < 25) {
            finishPolygon();
            return;
          }
        }

        setDrawingPoints(prev => [...prev, latLng]);
      }
    };

    const handleMapDblClick = (e: L.LeafletMouseEvent) => {
      if (mode === 'polygon' && drawingPoints.length >= 3) {
        finishPolygon();
      }
    };

    map.on('click', handleMapClick);
    map.on('dblclick', handleMapDblClick);

    return () => {
      map.off('click', handleMapClick);
      map.off('dblclick', handleMapDblClick);
    };
  }, [mode, circleRadius, drawingPoints, shape, onChange, finishPolygon]);

  // Mode changes: clear in-progress drawing points
  useEffect(() => {
    setDrawingPoints([]);
  }, [mode]);

  // Handle dragging completed polygon vertex
  const handleVertexDrag = useCallback((idx: number, newLatLng: L.LatLng) => {
    if (!shape || shape.type !== 'polygon' || !shape.points) return;
    const newPoints: [number, number][] = shape.points.map((pt, i) =>
      i === idx ? [newLatLng.lat, newLatLng.lng] : pt
    );
    onChange({
      type: 'polygon',
      points: newPoints
    });
  }, [shape, onChange]);

  // Render shapes, lines, points, and vertex handles
  useEffect(() => {
    if (!layerGroupRef.current || !mapRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    const polygonStyle: L.PathOptions = {
      color: '#2563eb',
      weight: 3,
      fillColor: '#3b82f6',
      fillOpacity: 0.28,
      interactive: false
    };

    // 1. Draw Active Completed Shape
    if (shape) {
      if (shape.type === 'circle' && shape.center) {
        const radius = shape.radius || circleRadius;
        L.circle(shape.center, { ...polygonStyle, radius }).addTo(group);
      } else if (shape.type === 'rectangle' && shape.corners && shape.corners.length >= 2) {
        const bounds = L.latLngBounds(shape.corners[0], shape.corners[1]);
        L.rectangle(bounds, polygonStyle).addTo(group);
      } else if (shape.type === 'polygon' && shape.points && shape.points.length >= 3) {
        // Completed polygon
        L.polygon(shape.points, polygonStyle).addTo(group);

        // Add corner handles so user can adjust corners if desired
        shape.points.forEach((p, idx) => {
          const vertexIcon = L.divIcon({
            className: 'vertex-handle-icon',
            html: `<div style="width:14px;height:14px;background:#ffffff;border:2.5px solid #2563eb;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);cursor:move;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });

          const vertexMarker = L.marker(p, {
            icon: vertexIcon,
            draggable: true,
            zIndexOffset: 1000
          }).addTo(group);

          vertexMarker.bindTooltip(`Corner #${idx + 1} (Drag to adjust)`, {
            direction: 'top',
            className: 'text-[10px] font-semibold'
          });

          vertexMarker.on('drag', (e: any) => {
            const pos = e.latlng || vertexMarker.getLatLng();
            handleVertexDrag(idx, pos);
          });
        });
      }
    }

    // 2. Draw In-Progress Drawing Points & Lines (Simple, intuitive visual feedback)
    if (drawingPoints.length > 0) {
      drawingPoints.forEach((p, idx) => {
        const isFirst = idx === 0;
        const canClose = isFirst && drawingPoints.length >= 3;

        const pointIcon = L.divIcon({
          className: 'drawing-point-icon',
          html: `<div style="width:20px;height:20px;background:${isFirst ? '#16a34a' : '#2563eb'};border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:bold;cursor:${canClose ? 'pointer' : 'default'};">
                  ${idx + 1}
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker(p, {
          icon: pointIcon,
          zIndexOffset: 2000
        }).addTo(group);

        if (canClose) {
          marker.bindTooltip('✨ Click to CLOSE Polygon', {
            permanent: true,
            direction: 'top',
            className: 'text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 shadow-sm'
          });
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            finishPolygon();
          });
        } else {
          marker.bindTooltip(`Point ${idx + 1}`, {
            direction: 'top',
            className: 'text-[10px] font-medium'
          });
        }
      });

      // Connecting line between placed points
      if (drawingPoints.length > 1) {
        L.polyline(drawingPoints, {
          color: '#2563eb',
          weight: 2.5,
          dashArray: '6, 6',
          interactive: false
        }).addTo(group);
      }

      // Preview polygon if >= 3 points placed
      if (drawingPoints.length >= 3) {
        L.polygon(drawingPoints, {
          color: '#16a34a',
          weight: 1.5,
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          dashArray: '4, 4',
          interactive: false
        }).addTo(group);
      }
    }
  }, [shape, drawingPoints, circleRadius, finishPolygon, handleVertexDrag]);

  // Geocoding search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: { lat: string; lon: string; display_name: string }) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 16);
    }
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-xs">
      {/* Top Search, GPS & Layer Controls */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/90">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="relative flex-1 min-w-[220px]">
            <input
              id="map-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, municipality, or parcel coordinates..."
              className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <button
              id="map-search-submit"
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition shadow-2xs"
            >
              {isSearching ? '...' : 'Search'}
            </button>

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectSearchResult(item)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-indigo-50 flex items-start gap-2 transition"
                  >
                    <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 text-slate-700 font-medium">{item.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Action buttons (Locate Me, Layer switcher, Reset) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* GPS Locate Me */}
            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              title="Pan map to my GPS location"
            >
              <Navigation className={`h-3.5 w-3.5 text-indigo-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLocating ? 'Locating...' : 'My GPS'}</span>
            </button>

            {/* Base Layer Switcher */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5">
              <button
                type="button"
                onClick={() => setTileType('osm')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'osm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Street Map"
              >
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden md:inline">Map</span>
              </button>
              <button
                type="button"
                onClick={() => setTileType('satellite')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'satellite' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Satellite Imagery"
              >
                <Globe2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden md:inline">Sat</span>
              </button>
              <button
                type="button"
                onClick={() => setTileType('terrain')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'terrain' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Topography & Relief"
              >
                <Mountain className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden md:inline">Relief</span>
              </button>
            </div>

            {/* Clear / Redraw button */}
            {(shape || drawingPoints.length > 0) && (
              <button
                id="clear-boundary-button"
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold hover:bg-rose-100 transition shadow-2xs"
                title="Clear boundary and draw again"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Simple, Step-by-Step Helper Status Bar */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between text-xs gap-2 z-10 border-b transition ${
        drawingPoints.length > 0
          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
          : shape
          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-2 font-medium">
          {mode === 'polygon' ? (
            drawingPoints.length === 0 ? (
              shape ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Polygon boundary selected.</strong> You can drag any corner handle to adjust, or click anywhere to draw a new one.
                  </span>
                </>
              ) : (
                <>
                  <MousePointerClick className="h-4 w-4 text-indigo-600 shrink-0 animate-bounce" />
                  <span>
                    <strong>Click anywhere on the map</strong> to place the 1st corner of your parcel polygon.
                  </span>
                </>
              )
            ) : drawingPoints.length === 1 ? (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Corner 1 placed.</strong> Click to place Corner 2.
                </span>
              </>
            ) : drawingPoints.length === 2 ? (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Corner 2 placed.</strong> Click to place Corner 3 to form a closed polygon.
                </span>
              </>
            ) : (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{drawingPoints.length} corners placed.</strong> Click more corners, or click <strong>Corner #1</strong> / <strong>Finish Polygon</strong> to complete.
                </span>
              </>
            )
          ) : mode === 'rectangle' ? (
            drawingPoints.length === 0 ? (
              <span>Click on the map to place the 1st corner of your rectangle parcel.</span>
            ) : (
              <span>Corner 1 set. Click second point for opposite corner.</span>
            )
          ) : (
            <span>Click anywhere on the map to center your circular parcel buffer.</span>
          )}
        </div>
        
        {/* Drawing Action Buttons (Undo / Finish / Redraw) */}
        <div className="flex items-center gap-2 shrink-0">
          {drawingPoints.length > 0 && (
            <button
              type="button"
              onClick={undoLastPoint}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              title="Undo last placed corner point"
            >
              <Undo2 className="h-3 w-3" />
              <span>Undo</span>
            </button>
          )}

          {drawingPoints.length >= 3 && (
            <button
              id="finish-polygon-btn"
              type="button"
              onClick={finishPolygon}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Finish Polygon ({drawingPoints.length} corners)</span>
            </button>
          )}

          {shape && drawingPoints.length === 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
            >
              <Pencil className="h-3 w-3 text-indigo-600" />
              <span>Draw New</span>
            </button>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div
        id="leaflet-map-canvas"
        ref={mapContainerRef}
        className="h-80 sm:h-96 w-full z-0 cursor-crosshair"
      />
    </div>
  );
};

export default MapPicker;
