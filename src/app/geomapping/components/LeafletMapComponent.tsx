'use client';
import React, { useEffect, useRef } from 'react';

type RiskZone = 'LOW' | 'MEDIUM' | 'HIGH';
type CollateralStatus = 'Perfected' | 'Under Review' | 'Overdue' | 'Submitted' | 'Draft';

interface CollateralPin {
  id: string;
  collateralId: string;
  titleDeed: string;
  obligor: string;
  type: string;
  status: CollateralStatus;
  lat: number;
  lng: number;
  address: string;
  addressVerified: boolean;
  riskZone: RiskZone;
  utilization: number;
  valueTZS: string;
  region: string;
}

interface LeafletMapProps {
  pins: CollateralPin[];
  selectedPin: CollateralPin | null;
  onPinSelect: (pin: CollateralPin | null) => void;
  showHeatmap: boolean;
  geocodeResult: { lat: number; lng: number; address: string } | null;
  flyToPin: { lat: number; lng: number } | null;
  onFlyToDone: () => void;
  center: [number, number];
  zoom: number;
}

const riskColors: Record<RiskZone, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

const statusColors: Record<CollateralStatus, string> = {
  Perfected: 'bg-green-100 text-green-700 border-green-200',
  'Under Review': 'bg-blue-100 text-blue-700 border-blue-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
  Submitted: 'bg-purple-100 text-purple-700 border-purple-200',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function LeafletMapComponent({
  pins,
  selectedPin,
  onPinSelect,
  showHeatmap,
  geocodeResult,
  flyToPin,
  onFlyToDone,
  center,
  zoom,
}: LeafletMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocodeMarkerRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    // Fix default icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when pins change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const L = require('leaflet');

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add new markers
    pins.forEach((pin) => {
      const color = riskColors[pin.riskZone];
      const isSelected = selectedPin?.id === pin.id;

      const svgIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: ${isSelected ? 28 : 20}px;
          height: ${isSelected ? 28 : 20}px;
          background: ${color};
          border: ${isSelected ? '3px solid #1e293b' : '2px solid white'};
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s;
        "></div>`,
        iconSize: [isSelected ? 28 : 20, isSelected ? 28 : 20],
        iconAnchor: [isSelected ? 14 : 10, isSelected ? 14 : 10],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon: svgIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:160px;font-family:DM Sans,sans-serif;font-size:12px;">
            <p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 4px">${pin.collateralId}</p>
            <p style="color:#64748b;margin:0 0 2px">${pin.obligor}</p>
            <p style="color:#94a3b8;margin:0 0 6px;font-size:11px">${pin.address}</p>
            <p style="color:#94a3b8;font-family:monospace;font-size:10px;margin:0">${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}</p>
          </div>
        `, { maxWidth: 240 });

      marker.on('click', () => onPinSelect(pin));
      markersRef.current.push(marker);
    });
  }, [pins, selectedPin]);

  // Handle heatmap toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing heat layer
    if (heatLayerRef.current) {
      heatLayerRef.current.remove();
      heatLayerRef.current = null;
    }

    if (showHeatmap && pins.length > 0) {
      // Simple heatmap using circle overlays (no extra plugin needed)
      const L = require('leaflet');
      const heatGroup = L.layerGroup();
      pins.forEach((pin) => {
        const weight = pin.riskZone === 'HIGH' ? 3 : pin.riskZone === 'MEDIUM' ? 2 : 1;
        const color = riskColors[pin.riskZone];
        L.circle([pin.lat, pin.lng], {
          radius: weight * 15000,
          color,
          fillColor: color,
          fillOpacity: 0.15,
          weight: 0,
        }).addTo(heatGroup);
      });
      heatGroup.addTo(map);
      heatLayerRef.current = heatGroup;
    }
  }, [showHeatmap, pins]);

  // Handle geocode result marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const L = require('leaflet');

    if (geocodeMarkerRef.current) {
      geocodeMarkerRef.current.remove();
      geocodeMarkerRef.current = null;
    }

    if (geocodeResult) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#0ea5e9;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      geocodeMarkerRef.current = L.marker([geocodeResult.lat, geocodeResult.lng], { icon })
        .addTo(map)
        .bindPopup(`<div style="font-size:11px;font-family:DM Sans,sans-serif;">${geocodeResult.address}</div>`);
    }
  }, [geocodeResult]);

  // Handle flyTo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !flyToPin) return;
    map.flyTo([flyToPin.lat, flyToPin.lng], 12, { duration: 1.2 });
    onFlyToDone();
  }, [flyToPin]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
