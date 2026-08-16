import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { BoundaryShape } from '../types';

interface MapPreviewProps {
  lat: number;
  lng: number;
  areaSize: number;
  boundary?: BoundaryShape;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  lat,
  lng,
  areaSize,
  boundary
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

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
  }, [lat, lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const pathStyle: L.PathOptions = {
      color: '#0ea5e9',
      weight: 3,
      fillColor: '#0ea5e9',
      fillOpacity: 0.25,
    };

    map.eachLayer(layer => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    if (boundary) {
      if (boundary.type === 'circle') {
        const radius = boundary.radius || Math.sqrt((areaSize || 1000) / Math.PI);
        L.marker([lat, lng]).addTo(map);
        L.circle([lat, lng], { ...pathStyle, radius }).addTo(map);
      } else if (boundary.type === 'rectangle' && boundary.corners && boundary.corners.length >= 2) {
        const bounds = L.latLngBounds(boundary.corners[0], boundary.corners[1]);
        L.rectangle(bounds, pathStyle).addTo(map);
        map.fitBounds(bounds, { padding: [20, 20] });
      } else if (boundary.type === 'polygon' && boundary.points && boundary.points.length >= 3) {
        const poly = L.polygon(boundary.points, pathStyle).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      }
    } else {
      const radius = Math.sqrt((areaSize || 1000) / Math.PI);
      L.marker([lat, lng]).addTo(map);
      L.circle([lat, lng], { ...pathStyle, radius }).addTo(map);
    }
  }, [lat, lng, areaSize, boundary]);

  return (
    <div
      ref={containerRef}
      className="h-56 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-xs z-0"
    />
  );
};
