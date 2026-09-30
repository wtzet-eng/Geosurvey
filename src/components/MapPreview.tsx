import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BoundaryShape } from '../types';

interface MapPreviewProps {
  lat: number;
  lng: number;
  areaSize: number;
  boundary?: BoundaryShape;
  officialGeometry?: [number, number][] | null;
  mappedGeometry?: [number, number][] | null;
  countryCode?: string;
  language?: string;
  ukJurisdiction?: 'ENGLAND_WALES' | 'SCOTLAND' | 'NORTHERN_IRELAND' | null;
}

const getMapLegend = (language?: string, countryCode?: string, ukJurisdiction?: 'ENGLAND_WALES' | 'SCOTLAND' | 'NORTHERN_IRELAND' | null) => {
  const lang = language?.toLowerCase().slice(0, 2);
  const isUk = countryCode?.toUpperCase() === 'GB';
  const labels: Record<string, { official: string; selected: string }> = {
    de: { official: 'Amtliche Flurstücksgrenze', selected: 'Ihre Auswahl' },
    hr: { official: 'Službena katastarska granica', selected: 'Vaš odabir' },
    pl: { official: 'Oficjalna granica działki', selected: 'Wybrany obszar' },
    fr: { official: 'Limite cadastrale officielle', selected: 'Votre sélection' },
    es: { official: 'Límite catastral oficial', selected: 'Su selección' },
    nl: { official: 'Officiële kadastrale grens', selected: 'Uw selectie' },
    fi: { official: 'Virallinen kiinteistöraja', selected: 'Valittu alue' },
    en: { official: 'Official cadastral boundary', selected: 'Your selection' },
  };
  if (isUk) {
    const ukLabels: Record<string, { official: string; selected: string }> = {
      en: { official: ukJurisdiction === 'SCOTLAND' ? 'Registers of Scotland cadastral parcel (indicative)' : ukJurisdiction === 'NORTHERN_IRELAND' ? 'Northern Ireland Land Registry map (reference)' : 'HMLR registered-property outline (indicative)', selected: 'Your selection' },
      de: { official: ukJurisdiction === 'SCOTLAND' ? 'Registers-of-Scotland-Katasterparzelle (Richtwert)' : ukJurisdiction === 'NORTHERN_IRELAND' ? 'Karte des nordirischen Grundbuchs (Referenz)' : 'HMLR-Grenze des registrierten Grundstücks (Richtwert)', selected: 'Ihre Auswahl' },
      hr: { official: ukJurisdiction === 'SCOTLAND' ? 'Katastarska čestica Registers of Scotland (indikativno)' : ukJurisdiction === 'NORTHERN_IRELAND' ? 'Karta sjevernoirskog zemljišnog registra (referenca)' : 'HMLR okvir registrirane nekretnine (indikativno)', selected: 'Vaš odabir' },
      pl: { official: ukJurisdiction === 'SCOTLAND' ? 'Orientacyjny obrys działki Registers of Scotland' : ukJurisdiction === 'NORTHERN_IRELAND' ? 'Mapa północnoirlandzkiego rejestru gruntów (referencja)' : 'Orientacyjny obrys zarejestrowanej nieruchomości HMLR', selected: 'Wybrany obszar' },
    };
    return ukLabels[lang || 'en'] || ukLabels.en;
  }
  return labels[lang || 'en'] || labels.en;
};

export const MapPreview: React.FC<MapPreviewProps> = ({
  lat,
  lng,
  areaSize,
  boundary,
  officialGeometry,
  mappedGeometry,
  countryCode,
  language,
  ukJurisdiction
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false
    });

    baseTileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    if (countryCode?.toUpperCase() === 'HR') {
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

    if (countryCode?.toUpperCase() === 'FI') {
      L.tileLayer.wms('https://inspire-wms.maanmittauslaitos.fi/inspire-wms/CP/ows', {
        layers: 'CP.CadastralParcel',
        styles: '',
        format: 'image/png',
        transparent: true,
        opacity: 0.85,
        version: '1.3.0',
        crs: L.CRS.EPSG3067,
        attribution: 'National Land Survey of Finland — INSPIRE Cadastral Parcels'
      }).addTo(map);
    }

    // The UK has separate official cadastral sources. Both overlays are added
    // because they are jurisdiction-specific: HM Land Registry covers
    // England and Wales, while Registers of Scotland covers Scotland.
    // Each service naturally returns no parcels outside its own coverage.
    if (countryCode?.toUpperCase() === 'GB') {
      if (ukJurisdiction !== 'SCOTLAND' && ukJurisdiction !== 'NORTHERN_IRELAND') L.tileLayer.wms('https://inspire.landregistry.gov.uk/inspire/ows', {
        layers: 'inspire:CP.CadastralParcel',
        styles: '',
        format: 'image/png',
        transparent: true,
        opacity: 0.85,
        version: '1.1.1',
        crs: L.CRS.EPSG3857,
        zIndex: 20,
        attribution: 'HM Land Registry INSPIRE Index Polygons'
      }).addTo(map);

      if (ukJurisdiction === 'SCOTLAND') L.tileLayer.wms('https://ros-inspire.themapcloud.com/maps/wms', {
        layers: 'CP.CadastralParcel',
        styles: '',
        format: 'image/png',
        transparent: true,
        opacity: 0.85,
        version: '1.1.1',
        crs: L.CRS.EPSG3857,
        zIndex: 20,
        attribution: 'Registers of Scotland INSPIRE Cadastral Parcels'
      }).addTo(map);
    }

    mapRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 150);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, countryCode, ukJurisdiction]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const selectedStyle: L.PathOptions = {
      color: '#0ea5e9',
      weight: 3,
      fillColor: '#0ea5e9',
      fillOpacity: 0.25,
    };
    const officialStyle: L.PathOptions = {
      color: '#111827',
      weight: 3,
      dashArray: '7 5',
      fillOpacity: 0,
    };

    map.eachLayer(layer => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds([]);
    const extendWithBounds = (layer: L.Layer) => {
      if (layer instanceof L.Path) {
        const layerBounds = (layer as L.Polyline).getBounds?.();
        if (layerBounds && layerBounds.isValid()) bounds.extend(layerBounds);
      }
    };

    if (boundary) {
      if (boundary.type === 'circle') {
        const radius = boundary.radius || Math.sqrt((areaSize || 1000) / Math.PI);
        const marker = L.marker([lat, lng]).addTo(map);
        const circle = L.circle([lat, lng], { ...selectedStyle, radius }).addTo(map);
        bounds.extend(circle.getBounds());
        bounds.extend(marker.getLatLng());
      } else if (boundary.type === 'rectangle' && boundary.corners && boundary.corners.length >= 2) {
        const rectangle = L.rectangle(L.latLngBounds(boundary.corners[0], boundary.corners[1]), selectedStyle).addTo(map);
        extendWithBounds(rectangle);
      } else if (boundary.type === 'polygon' && boundary.points && boundary.points.length >= 3) {
        const poly = L.polygon(boundary.points, selectedStyle).addTo(map);
        extendWithBounds(poly);
      }
    } else {
      const radius = Math.sqrt((areaSize || 1000) / Math.PI);
      const marker = L.marker([lat, lng]).addTo(map);
      const circle = L.circle([lat, lng], { ...selectedStyle, radius }).addTo(map);
      bounds.extend(circle.getBounds());
      bounds.extend(marker.getLatLng());
    }

    const outlineGeometry = officialGeometry && officialGeometry.length >= 3 ? officialGeometry : mappedGeometry;
    if (outlineGeometry && outlineGeometry.length >= 3) {
      const official = L.polygon(outlineGeometry, officialStyle).addTo(map);
      bounds.extend(official.getBounds());
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [lat, lng, areaSize, boundary, officialGeometry, mappedGeometry]);

  const showOfficialBoundary = Boolean((officialGeometry && officialGeometry.length >= 3) || (mappedGeometry && mappedGeometry.length >= 3));
  const isUk = countryCode?.toUpperCase() === 'GB';
  const legend = getMapLegend(language, countryCode, ukJurisdiction);

  return (
    <div className="relative h-56 w-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs z-0 dark:border-slate-700 dark:bg-[#1b211d]">
      <div ref={containerRef} className="absolute inset-0" />
      {(showOfficialBoundary || isUk) && (
        <div className="absolute top-3 right-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm text-[10px] font-medium text-slate-700 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-6 border-t-[3px] border-dashed border-slate-900" aria-hidden="true" />
            <span>{legend.official}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 border-t-[3px] border-sky-500" aria-hidden="true" />
            <span>{legend.selected}</span>
          </div>
        </div>
      )}
    </div>
  );
};
