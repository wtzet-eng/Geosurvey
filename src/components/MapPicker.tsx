import { apiFetch } from '../lib/apiClient';
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
import { formatMapPickerText, getMapPickerText } from '../utils/mapPickerI18n';

const BAVARIA_CADASTRAL_CONTEXT = {
  viewServiceUrl: 'https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte_2026',
  viewLayer: 'by_alkis_parzellarkarte_grau',
  viewStyle: '',
  attribution: '© Bayerische Vermessungsverwaltung — ALKIS-Parzellarkarte, Stand 01.01.2026'
};

// Keep the site marker inside the selected cadastral parcel rather than at the
// original search point, which can sit near a parcel edge and obscure controls.
const getPolygonCentroid = (points: [number, number][]): L.LatLng => {
  let area = 0;
  let centroidLat = 0;
  let centroidLng = 0;

  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    const cross = lng1 * lat2 - lng2 * lat1;
    area += cross;
    centroidLat += (lat1 + lat2) * cross;
    centroidLng += (lng1 + lng2) * cross;
  }

  if (Math.abs(area) < 1e-12) {
    return L.latLngBounds(points as L.LatLngExpression[]).getCenter();
  }

  return L.latLng(centroidLat / (3 * area), centroidLng / (3 * area));
};

interface MapPickerProps {
  mode: BoundaryType;
  shape: BoundaryShape | null;
  onChange: (shape: BoundaryShape | null) => void;
  circleRadius: number;
  onClear: () => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  language?: string;
  countryCode?: string;
  onCountryDetected?: (countryCode: string) => void;
  onOfficialParcelSelected?: (parcel: { parcelId?: string; areaM2?: number } | null) => void;
  onParcelLookupStateChange?: (isFinding: boolean) => void;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  mode,
  shape,
  onChange,
  circleRadius,
  onClear,
  defaultCenter = [51.1657, 10.4515],
  defaultZoom = 6,
  language = 'en',
  countryCode = 'PL',
  onCountryDetected,
  onOfficialParcelSelected,
  onParcelLookupStateChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const addressMarkerRef = useRef<L.Marker | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ display_name: string; lat: string; lon: string; address?: { country_code?: string; state?: string; province?: string; region?: string; 'ISO3166-2-lvl4'?: string } }[]>([]);
  const [tileType, setTileType] = useState<'osm' | 'satellite' | 'terrain'>('osm');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isFindingParcel, setIsFindingParcel] = useState(false);
  const parcelLookupPendingRef = useRef(false);
  const [officialParcel, setOfficialParcel] = useState<{ parcelId?: string; areaM2?: number; state?: string; stateCode?: string; viewServiceUrl?: string; viewLayer?: string; viewStyle?: string; viewAttribution?: string } | null>(null);
  const [cadastralState, setCadastralState] = useState<string | null>(null);
  const [cadastralContext, setCadastralContext] = useState<{ viewServiceUrl: string; viewLayer: string; viewStyle: string; attribution: string } | null>(null);
  const t = getMapPickerText(language);

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
    if (countryCode.toUpperCase() === 'DE') {
      const view = officialParcel?.viewServiceUrl
        ? {
            viewServiceUrl: officialParcel.viewServiceUrl,
            viewLayer: officialParcel.viewLayer || 'CP.CadastralParcel',
            viewStyle: officialParcel.viewStyle || 'default',
            attribution: officialParcel.viewAttribution || 'Official German cadastral data'
          }
        : cadastralContext;
      if (view) {
        L.tileLayer.wms(view.viewServiceUrl, {
          layers: view.viewLayer,
          styles: view.viewStyle,
          format: 'image/png',
          transparent: true,
          opacity: 0.8,
          version: '1.3.0',
          attribution: view.attribution
        }).addTo(map);
      }
    } else if (countryCode.toUpperCase() === 'HR' && officialParcel) {
      L.tileLayer.wms('https://api.uredjenazemlja.hr/services/inspire/cp_wms/wms', {
        layers: 'CP.CadastralParcel',
        styles: 'CP.CadastralParcel.Default',
        format: 'image/png',
        transparent: true,
        opacity: 0.85,
        version: '1.3.0',
        crs: L.CRS.EPSG4326,
        attribution: 'DGU cadastral parcels'
      }).addTo(map);
    }
  }, [tileType, countryCode, officialParcel]);

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
    setOfficialParcel(null);
    setCadastralContext(null);
    onOfficialParcelSelected?.(null);
    onClear();
  }, [onClear, onOfficialParcelSelected]);

  // Geolocation trigger (pans map to user's location)
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert(t.geolocationUnsupported);
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

  // Find and select an official parcel at a clicked map location.
  const findOfficialParcelAtPoint = useCallback(async (lat: number, lng: number) => {
    const lookupCountry = countryCode.toUpperCase();
    if (!['DE', 'HR'].includes(lookupCountry)) return false;
    if (lookupCountry === 'DE' && !cadastralState) return false;

    if (parcelLookupPendingRef.current) return false;
    parcelLookupPendingRef.current = true;
    setIsFindingParcel(true);
    onParcelLookupStateChange?.(true);
    try {
      const stateParam = lookupCountry === 'DE' && cadastralState ? '&state=' + encodeURIComponent(cadastralState) : '';
      const response = await apiFetch('/api/cadastre/query?lat=' + lat.toFixed(6) + '&lng=' + lng.toFixed(6) + '&country=' + lookupCountry + stateParam);
      if (!response.ok) return false;
      const parcel = await response.json();
      if (!parcel.success) return false;

      if (Array.isArray(parcel.geometryPoints) && parcel.geometryPoints.length >= 3) {
        const selectedParcel = {
          parcelId: parcel.parcel?.parcelNumber || parcel.parcelId,
          areaM2: parcel.parcel?.officialAreaM2 || parcel.officialAreaM2,
          state: parcel.parcel?.state,
          stateCode: parcel.parcel?.stateCode,
          viewServiceUrl: parcel.viewServiceUrl,
          viewLayer: parcel.viewLayer,
          viewStyle: parcel.viewStyle,
          viewAttribution: parcel.viewAttribution
        };
        setOfficialParcel(selectedParcel);
        onOfficialParcelSelected?.(selectedParcel);
        const points = parcel.geometryPoints as [number, number][];
        onChange({ type: 'polygon', points });
        addressMarkerRef.current?.setLatLng(getPolygonCentroid(points));
        if (mapRef.current) {
          const bounds = L.latLngBounds(points as L.LatLngExpression[]);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Cadastral click lookup notice:', err);
      return false;
    } finally {
      parcelLookupPendingRef.current = false;
      setIsFindingParcel(false);
      onParcelLookupStateChange?.(false);
    }
  }, [countryCode, cadastralState, onChange, onOfficialParcelSelected, onParcelLookupStateChange]);

  // Map Click & Double Click Handling
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const latLng: [number, number] = [e.latlng.lat, e.latlng.lng];

      // Germany and Croatia: a map click can select the official cadastral parcel
      // instead of forcing the user to redraw a boundary manually. If no official
      // parcel is found, fall back to the existing drawing behaviour.
      if (['DE', 'HR'].includes(countryCode.toUpperCase()) && mode === 'polygon' && drawingPoints.length === 0) {
        // While cadastral lookup is in progress, keep map clicks in parcel-selection
        // mode. Do not accidentally turn a parcel click into a manual polygon point.
        if (parcelLookupPendingRef.current || isFindingParcel) return;
        const selected = await findOfficialParcelAtPoint(latLng[0], latLng[1]);
        if (selected) return;
      }

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
          setOfficialParcel(null);
          setDrawingPoints([latLng]);
          return;
        }

        // Do not auto-close when a click happens near the first point.
        // On small or dense plots this can make the fourth corner impossible to place.
        // Finish explicitly with the finish control or double-click.
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
  }, [mode, circleRadius, drawingPoints, shape, onChange, finishPolygon, countryCode, findOfficialParcelAtPoint, isFindingParcel]);

  // Mode changes: clear in-progress drawing points
  useEffect(() => {
    setDrawingPoints([]);
  }, [mode]);

  // State context is only meaningful while Germany is selected; do not carry
  // a previously detected German Land into another country's lookup.
  useEffect(() => {
    if (countryCode.toUpperCase() !== 'DE') {
      setCadastralState(null);
      setCadastralContext(null);
    }
  }, [countryCode]);

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
        // Official cadastral geometry is evidence, not a manually editable drawing.
        const shapeStyle = officialParcel
          ? { ...polygonStyle, color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.16 }
          : polygonStyle;
        L.polygon(shape.points, shapeStyle).addTo(group);

        // Manually drawn polygons remain editable. Official cadastral geometry does not.
        if (!officialParcel) shape.points.forEach((p, idx) => {
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

          vertexMarker.bindTooltip(formatMapPickerText(t.cornerTooltip, idx + 1), {
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

        const pointIcon = L.divIcon({
          className: 'drawing-point-icon',
          html: `<div style="width:20px;height:20px;background:${isFirst ? '#16a34a' : '#2563eb'};border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:11px;font-weight:bold;cursor:default;">
                  ${idx + 1}
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker(p, {
          icon: pointIcon,
          zIndexOffset: 2000,
          interactive: isFirst && drawingPoints.length >= 3
        }).addTo(group);

        marker.bindTooltip(formatMapPickerText(t.point, idx + 1), {
          direction: 'top',
          className: 'text-[10px] font-medium pointer-events-none'
        });

        // The first point is the explicit "close" target once at least three
        // corners exist. This avoids the old distance-based auto-close while
        // still making closing the polygon intuitive.
        if (isFirst && drawingPoints.length >= 3) {
          marker.on('click', (event: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event);
            finishPolygon();
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
  }, [shape, drawingPoints, circleRadius, finishPolygon, handleVertexDrag, t, officialParcel]);

  // Geocoding search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Geocoding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = async (result: { lat: string; lon: string; display_name: string; address?: { country_code?: string; state?: string; province?: string; region?: string; 'ISO3166-2-lvl4'?: string } }) => {
    const lat = parseFloat(result.lat);
    const detectedCountry = result.address?.country_code?.toUpperCase();
    const detectedState = result.address?.state || result.address?.province || result.address?.region || result.address?.['ISO3166-2-lvl4'];
    const detectedStateNormalized = String(detectedState || '').trim().toLowerCase();
    setCadastralContext(detectedStateNormalized === 'bayern' || detectedStateNormalized === 'bavaria' || detectedStateNormalized === 'de-by' ? BAVARIA_CADASTRAL_CONTEXT : null);
    if (detectedState) setCadastralState(detectedState);
    if (detectedCountry && detectedCountry !== countryCode.toUpperCase()) {
      onCountryDetected?.(detectedCountry);
    }
    const lon = parseFloat(result.lon);

    if (mapRef.current) {
      mapRef.current.setView([lat, lon], 16);
      addressMarkerRef.current?.remove();
      addressMarkerRef.current = L.marker([lat, lon])
        .addTo(mapRef.current)
        .bindPopup(result.display_name)
        .openPopup();
    }
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    setOfficialParcel(null);
    onOfficialParcelSelected?.(null);

    const searchCountryCode = detectedCountry || countryCode.toUpperCase();
    if (['DE', 'PL', 'HR'].includes(searchCountryCode)) {
      parcelLookupPendingRef.current = true;
      setIsFindingParcel(true);
      onParcelLookupStateChange?.(true);
      try {
        const stateParam = searchCountryCode === 'DE' && detectedState ? '&state=' + encodeURIComponent(detectedState) : '';
        const response = await apiFetch('/api/cadastre/query?lat=' + lat.toFixed(6) + '&lng=' + lon.toFixed(6) + '&country=' + searchCountryCode + stateParam);
        if (!response.ok) throw new Error('Cadastral lookup failed');
        const parcel = await response.json();

        if (parcel.success) {
          const selectedParcel = { parcelId: parcel.parcel?.parcelNumber || parcel.parcelId, areaM2: parcel.parcel?.officialAreaM2 || parcel.officialAreaM2, state: parcel.parcel?.state, stateCode: parcel.parcel?.stateCode, viewServiceUrl: parcel.viewServiceUrl, viewLayer: parcel.viewLayer, viewStyle: parcel.viewStyle, viewAttribution: parcel.viewAttribution };
          setOfficialParcel(selectedParcel);
          setCadastralContext(null);
          onOfficialParcelSelected?.(selectedParcel);
          if (Array.isArray(parcel.geometryPoints) && parcel.geometryPoints.length >= 3) {
            const points = parcel.geometryPoints as [number, number][];
            onChange({ type: 'polygon', points });
            addressMarkerRef.current?.setLatLng(getPolygonCentroid(points));
            if (mapRef.current) {
              const bounds = L.latLngBounds(points as L.LatLngExpression[]);
              mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
            }
          } else if (mapRef.current) {
            mapRef.current.setView([lat, lon], 18);
          }
        }
      } catch (err) {
        console.warn('Cadastral lookup notice:', err);
      } finally {
        parcelLookupPendingRef.current = false;
        setIsFindingParcel(false);
        onParcelLookupStateChange?.(false);
      }
    }
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
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <button
              id="map-search-submit"
              type="submit"
              disabled={isSearching}
              className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition shadow-2xs"
            >
              {isSearching ? '...' : t.search}
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
              title={t.locateTitle}
            >
              <Navigation className={`h-3.5 w-3.5 text-indigo-600 ${isLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLocating ? t.locating : t.myGps}</span>
            </button>

            {/* Base Layer Switcher */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5">
              <button
                type="button"
                onClick={() => setTileType('osm')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'osm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.streetTitle}
              >
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span className="hidden md:inline">{t.map}</span>
              </button>
              <button
                type="button"
                onClick={() => setTileType('satellite')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'satellite' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.satelliteTitle}
              >
                <Globe2 className="h-3.5 w-3.5 text-blue-600" />
                <span className="hidden md:inline">{t.sat}</span>
              </button>
              <button
                type="button"
                onClick={() => setTileType('terrain')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                  tileType === 'terrain' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.terrainTitle}
              >
                <Mountain className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden md:inline">{t.relief}</span>
              </button>
            </div>

            {/* Clear / Redraw button */}
            {(shape || drawingPoints.length > 0) && (
              <button
                id="clear-boundary-button"
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-semibold hover:bg-rose-100 transition shadow-2xs"
                title={t.clearTitle}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.clear}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Simple, Step-by-Step Helper Status Bar */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between text-xs gap-2 z-10 border-b transition ${
        officialParcel || isFindingParcel
          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          : drawingPoints.length > 0
          ? 'bg-amber-50/90 border-amber-200 text-amber-950'
          : shape
          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-2 font-medium">
          {isFindingParcel ? (
            <><Crosshair className="h-4 w-4 text-emerald-600 animate-pulse shrink-0" /><span>{t.findingParcel}</span></>
          ) : officialParcel ? (
            <><Check className="h-4 w-4 text-emerald-600 shrink-0" /><span><strong>{t.officialParcelFound}</strong>{officialParcel.parcelId ? ' · ' + officialParcel.parcelId : ''}</span></>
          ) : mode === 'polygon' ? (
            drawingPoints.length === 0 ? (
              shape ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>{t.polygonSelected}</strong> {t.polygonAdjust}
                  </span>
                </>
              ) : (
                <>
                  <MousePointerClick className="h-4 w-4 text-indigo-600 shrink-0 animate-bounce" />
                  <span>
                    <strong>{t.clickMap}</strong> {t.firstCorner}
                  </span>
                </>
              )
            ) : drawingPoints.length === 1 ? (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{t.afterFirstPoint}</span>
              </>
            ) : drawingPoints.length === 2 ? (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{t.corner2Placed}</strong> {t.clickCorner3}
                </span>
              </>
            ) : (
              <>
                <MousePointerClick className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{formatMapPickerText(t.cornersPlaced, drawingPoints.length)}</strong> {t.clickMoreCorners}
                </span>
              </>
            )
          ) : mode === 'rectangle' ? (
            drawingPoints.length === 0 ? (
              <span>{t.rectangleFirst}</span>
            ) : (
              <span>{t.rectangleSecond}</span>
            )
          ) : (
            <span>{t.circleCenter}</span>
          )}
        </div>
        
        {/* Drawing status only — actions float over the map below. */}
      </div>

      {/* Drawing Action Buttons: bottom-center on mobile, bottom-right on desktop. */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 sm:left-auto sm:right-3 sm:translate-x-0 z-[1000] flex items-center gap-2">
          {drawingPoints.length > 0 && (
            <button
              type="button"
              onClick={undoLastPoint}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
              title={t.undoTitle}
            >
              <Undo2 className="h-3 w-3" />
              <span>{t.undo}</span>
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
              <span>{formatMapPickerText(t.finishPolygon, drawingPoints.length)}</span>
            </button>
          )}

          {shape && drawingPoints.length === 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-2xs"
            >
              <Pencil className="h-3 w-3 text-indigo-600" />
              <span>{t.drawNew}</span>
            </button>
          )}
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
