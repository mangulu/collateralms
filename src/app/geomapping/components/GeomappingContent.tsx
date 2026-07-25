'use client';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  HeatmapLayer,
} from '@react-google-maps/api';
import {
  Map,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Search,
  Navigation,
  Layers,
  Info,
  Shield,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { geocodeAddress, validateAddressPair } from '@/lib/googleMaps/geocodingService';

declare const google: any;

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface AddressValidation {
  collateralId: string;
  idAddress: string;
  collateralAddress: string;
  matchScore: number;
  matchType: 'EXACT' | 'PARTIAL' | 'MISMATCH';
  sameRegion: boolean;
  flagged: boolean;
  geocodedLat?: number;
  geocodedLng?: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockPins: CollateralPin[] = [
  { id: '1', collateralId: 'COL-2024-0891', titleDeed: 'TD-00123', obligor: 'Tanzanian Steel Industries', type: 'Land & Property', status: 'Perfected', lat: -6.7924, lng: 39.2083, address: 'Ohio Street, Dar es Salaam, Tanzania', addressVerified: true, riskZone: 'LOW', utilization: 72.5, valueTZS: '2,500,000,000', region: 'Dar es Salaam' },
  { id: '2', collateralId: 'COL-2024-0756', titleDeed: 'TD-00456', obligor: 'Kilimanjaro Coffee Exporters', type: 'Land & Property', status: 'Under Review', lat: -3.3731, lng: 36.6823, address: 'Moshi Town, Kilimanjaro, Tanzania', addressVerified: true, riskZone: 'LOW', utilization: 55.0, valueTZS: '850,000,000', region: 'Kilimanjaro' },
  { id: '3', collateralId: 'COL-2024-0612', titleDeed: 'TD-00789', obligor: 'Dar es Salaam Logistics Co.', type: 'Motor Vehicles', status: 'Perfected', lat: -6.8160, lng: 39.2803, address: 'Temeke, Dar es Salaam, Tanzania', addressVerified: false, riskZone: 'MEDIUM', utilization: 88.3, valueTZS: '320,000,000', region: 'Dar es Salaam' },
  { id: '4', collateralId: 'COL-2024-0534', titleDeed: 'TD-01012', obligor: 'Mwanza Fish Processing Ltd', type: 'Equipment', status: 'Overdue', lat: -2.5164, lng: 32.9175, address: 'Mwanza City Centre, Tanzania', addressVerified: true, riskZone: 'HIGH', utilization: 95.1, valueTZS: '180,000,000', region: 'Mwanza' },
  { id: '5', collateralId: 'COL-2024-0489', titleDeed: 'TD-01345', obligor: 'Arusha New Ventures Ltd', type: 'Land & Property', status: 'Submitted', lat: -3.3869, lng: 36.6830, address: 'Arusha CBD, Tanzania', addressVerified: true, riskZone: 'LOW', utilization: 60.0, valueTZS: '1,200,000,000', region: 'Arusha' },
  { id: '6', collateralId: 'COL-2024-0321', titleDeed: 'TD-01678', obligor: 'Dodoma Grain Traders', type: 'Land & Property', status: 'Perfected', lat: -6.1722, lng: 35.7395, address: 'Dodoma Capital Area, Tanzania', addressVerified: true, riskZone: 'MEDIUM', utilization: 45.2, valueTZS: '650,000,000', region: 'Dodoma' },
  { id: '7', collateralId: 'COL-2024-0290', titleDeed: 'TD-02001', obligor: 'Zanzibar Spice Exports', type: 'Land & Property', status: 'Draft', lat: -6.1659, lng: 39.2026, address: 'Stone Town, Zanzibar, Tanzania', addressVerified: false, riskZone: 'HIGH', utilization: 0, valueTZS: '420,000,000', region: 'Zanzibar' },
];

const mockValidations: AddressValidation[] = [
  { collateralId: 'COL-2024-0891', idAddress: 'Ohio Street, Dar es Salaam, Tanzania', collateralAddress: 'Ohio Street, Dar es Salaam, Tanzania', matchScore: 100, matchType: 'EXACT', sameRegion: true, flagged: false },
  { collateralId: 'COL-2024-0612', idAddress: 'Temeke District, Dar es Salaam, Tanzania', collateralAddress: 'Temeke, Dar es Salaam, Tanzania', matchScore: 78, matchType: 'PARTIAL', sameRegion: true, flagged: false },
  { collateralId: 'COL-2024-0534', idAddress: 'Dar es Salaam, Tanzania', collateralAddress: 'Mwanza City Centre, Tanzania', matchScore: 12, matchType: 'MISMATCH', sameRegion: false, flagged: true },
  { collateralId: 'COL-2024-0290', idAddress: 'Dar es Salaam, Tanzania', collateralAddress: 'Stone Town, Zanzibar, Tanzania', matchScore: 25, matchType: 'MISMATCH', sameRegion: false, flagged: true },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const LIBRARIES: ('visualization' | 'places' | 'geometry')[] = ['visualization', 'places'];

const TANZANIA_CENTER = { lat: -6.3690, lng: 34.8888 };

const MAP_STYLES: { featureType?: string; elementType?: string; stylers: Record<string, string | number>[] }[] = [
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a2daf2' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0f4f0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#94a3b8' }, { weight: 1 }] },
];

const riskZoneConfig: Record<RiskZone, { color: string; bg: string; border: string; dot: string; markerColor: string }> = {
  LOW: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', markerColor: '#22c55e' },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500', markerColor: '#f59e0b' },
  HIGH: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', markerColor: '#ef4444' },
};

const statusColors: Record<CollateralStatus, string> = {
  Perfected: 'bg-green-100 text-green-700 border-green-200',
  'Under Review': 'bg-blue-100 text-blue-700 border-blue-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
  Submitted: 'bg-purple-100 text-purple-700 border-purple-200',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
};

const matchTypeColors: Record<AddressValidation['matchType'], string> = {
  EXACT: 'bg-green-100 text-green-700 border-green-200',
  PARTIAL: 'bg-amber-100 text-amber-700 border-amber-200',
  MISMATCH: 'bg-red-100 text-red-700 border-red-200',
};

// ─── Marker Icon Helper ───────────────────────────────────────────────────────

function getMarkerIcon(pin: CollateralPin, isSelected: boolean) {
  const color = riskZoneConfig[pin.riskZone].markerColor;
  if (typeof google === 'undefined') return undefined;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: isSelected ? '#1e293b' : '#ffffff',
    strokeWeight: isSelected ? 3 : 2,
    scale: isSelected ? 14 : 10,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeomappingContent() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [selectedPin, setSelectedPin] = useState<CollateralPin | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'validation' | 'risk'>('map');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [pins, setPins] = useState<CollateralPin[]>([]);
  const [validations, setValidations] = useState<AddressValidation[]>(mockValidations);
  const [geocodingStatus, setGeocodingStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [validatingAll, setValidatingAll] = useState(false);
  const [geocodeSearch, setGeocodeSearch] = useState('');
  const [geocodeResult, setGeocodeResult] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [loadingPins, setLoadingPins] = useState(true);

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Load real collateral pins from Supabase
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      supabase
        .from('collateral_records')
        .select('id, collateral_id, obligor, collateral_type, status, latitude, longitude, location_address, description, value_tsh')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const livePins: CollateralPin[] = data.map((row: any, idx: number) => ({
              id: row.id,
              collateralId: row.collateral_id,
              titleDeed: row.collateral_id,
              obligor: row.obligor ?? 'Unknown',
              type: row.collateral_type ?? 'Other',
              status: row.status as CollateralStatus,
              lat: parseFloat(row.latitude),
              lng: parseFloat(row.longitude),
              address: row.location_address ?? row.description ?? '',
              addressVerified: true,
              riskZone: 'LOW' as RiskZone,
              utilization: 0,
              valueTZS: row.value_tsh ?? '0',
              region: row.location_address ?? '',
            }));
            setPins(livePins);
          } else {
            // Fall back to mock data if no geo-tagged records exist
            setPins(mockPins);
          }
          setLoadingPins(false);
        })
        .catch(() => {
          setPins(mockPins);
          setLoadingPins(false);
        });
    });
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
  }, []);

  const filtered = pins.filter((p) => {
    const matchSearch = !search || p.collateralId.toLowerCase().includes(search.toLowerCase()) || p.obligor.toLowerCase().includes(search.toLowerCase()) || p.region.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || p.type === typeFilter;
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchRisk = riskFilter === 'All' || p.riskZone === riskFilter;
    return matchSearch && matchType && matchStatus && matchRisk;
  });

  const highRisk = pins.filter((p) => p.riskZone === 'HIGH').length;
  const unverified = pins.filter((p) => !p.addressVerified).length;
  const flagged = validations.filter((v) => v.flagged).length;

  // Geocode a single pin's address to update its coordinates
  const geocodePin = useCallback(async (pin: CollateralPin) => {
    if (!geocoderRef.current) return;
    setGeocodingStatus((prev) => ({ ...prev, [pin.id]: 'loading' }));
    try {
      const result = await geocodeAddress(pin.address, geocoderRef.current);
      if (result.isValid) {
        setPins((prev) =>
          prev.map((p) =>
            p.id === pin.id
              ? { ...p, lat: result.lat, lng: result.lng, addressVerified: true }
              : p
          )
        );
        setGeocodingStatus((prev) => ({ ...prev, [pin.id]: 'done' }));
      } else {
        setGeocodingStatus((prev) => ({ ...prev, [pin.id]: 'error' }));
      }
    } catch {
      setGeocodingStatus((prev) => ({ ...prev, [pin.id]: 'error' }));
    }
  }, []);

  // Validate all address pairs using Google Maps Geocoding
  const validateAllAddresses = useCallback(async () => {
    if (!geocoderRef.current) return;
    setValidatingAll(true);
    const updated: AddressValidation[] = [];
    for (const v of validations) {
      const result = await validateAddressPair(v.idAddress, v.collateralAddress, geocoderRef.current);
      updated.push({
        ...v,
        matchScore: result.matchScore,
        matchType: result.matchType,
        sameRegion: result.sameRegion,
        flagged: result.flagged,
        geocodedLat: result.geocoded?.lat,
        geocodedLng: result.geocoded?.lng,
      });
    }
    setValidations(updated);
    setValidatingAll(false);
  }, [validations]);

  // Geocode a custom address search
  const handleGeocodeSearch = useCallback(async () => {
    if (!geocoderRef.current || !geocodeSearch.trim()) return;
    setGeocodeLoading(true);
    const result = await geocodeAddress(geocodeSearch, geocoderRef.current);
    if (result.isValid && mapRef.current) {
      mapRef.current.panTo({ lat: result.lat, lng: result.lng });
      mapRef.current.setZoom(14);
      setGeocodeResult({ lat: result.lat, lng: result.lng, address: result.formattedAddress });
    }
    setGeocodeLoading(false);
  }, [geocodeSearch]);

  // Heatmap data points
  const heatmapData = isLoaded
    ? filtered.map((p) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: p.riskZone === 'HIGH' ? 3 : p.riskZone === 'MEDIUM' ? 2 : 1,
      }))
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
          <Map size={18} className="text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-700 text-foreground">Geomapping & Location Intelligence</h1>
          <p className="text-sm text-muted-foreground">Interactive collateral map, geographic risk zones, and borrower address validation</p>
        </div>
      </div>

      {/* API Key Warning */}
      {!apiKey && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
          <span>
            <strong>Google Maps API key not configured.</strong> Add{' '}
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your environment variables to enable the interactive map.
          </span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Mapped', value: pins.length, sub: 'Collateral with coordinates', icon: MapPin, variant: 'default' as const },
          { label: 'High Risk Zones', value: highRisk, sub: 'Flood/conflict areas', icon: AlertTriangle, variant: 'danger' as const },
          { label: 'Unverified Addresses', value: unverified, sub: 'Address not validated', icon: Navigation, variant: 'warning' as const },
          { label: 'Address Mismatches', value: flagged, sub: 'ID vs collateral address', icon: Shield, variant: 'danger' as const },
        ].map(({ label, value, sub, icon: IconComp, variant }) => {
          const bg = { default: 'bg-white border-border', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200' };
          const iconBg = { default: 'bg-primary/10 text-primary', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600' };
          const valColor = { default: 'text-foreground', danger: 'text-red-700', warning: 'text-amber-700' };
          return (
            <div key={label} className={`rounded-xl p-4 border shadow-card ${bg[variant]}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
                  {React.createElement(IconComp, { size: 15 })}
                </div>
              </div>
              <p className={`text-2xl font-700 tabular-nums font-mono ${valColor[variant]}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex border-b border-border">
          {[
            { key: 'map' as const, label: 'Map View', icon: Map },
            { key: 'validation' as const, label: 'Address Validation', icon: CheckCircle2 },
            { key: 'risk' as const, label: 'Risk Zones', icon: AlertTriangle },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-500 border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'map' && (
          <div className="p-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search collateral, region..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none">
                <option value="All">All Risk Zones</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none">
                <option value="All">All Statuses</option>
                <option value="Perfected">Perfected</option>
                <option value="Under Review">Under Review</option>
                <option value="Overdue">Overdue</option>
              </select>
              <button
                onClick={() => setShowHeatmap((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${showHeatmap ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:text-foreground'}`}
              >
                <Layers size={13} />
                Heatmap
              </button>
            </div>

            {/* Geocode Search Bar */}
            {isLoaded && (
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Navigation size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Geocode an address (e.g. Kariakoo Market, Dar es Salaam)..."
                    value={geocodeSearch}
                    onChange={(e) => setGeocodeSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGeocodeSearch()}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  onClick={handleGeocodeSearch}
                  disabled={geocodeLoading || !geocodeSearch.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {geocodeLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Geocode
                </button>
              </div>
            )}

            {geocodeResult && (
              <div className="mb-3 flex items-center gap-2 p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                <CheckCircle2 size={13} className="text-teal-600 shrink-0" />
                <span><strong>Geocoded:</strong> {geocodeResult.address}</span>
                <span className="font-mono ml-auto shrink-0">{geocodeResult.lat.toFixed(4)}, {geocodeResult.lng.toFixed(4)}</span>
                <button onClick={() => setGeocodeResult(null)} className="ml-1 text-teal-500 hover:text-teal-700"><X size={12} /></button>
              </div>
            )}

            <div className="flex gap-4 h-[420px]">
              {/* Map */}
              <div className="flex-1 rounded-xl overflow-hidden border border-border">
                {loadError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-600 text-sm gap-2">
                    <AlertTriangle size={24} />
                    <p className="font-600">Failed to load Google Maps</p>
                    <p className="text-xs text-red-500">Check your API key and network connection</p>
                  </div>
                ) : !isLoaded ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/20">
                    <Loader2 size={24} className="animate-spin text-primary" />
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={TANZANIA_CENTER}
                    zoom={6}
                    onLoad={onMapLoad}
                    options={{
                      styles: MAP_STYLES,
                      mapTypeControl: false,
                      streetViewControl: false,
                      fullscreenControl: true,
                      zoomControl: true,
                    }}
                  >
                    {/* Heatmap Layer */}
                    {showHeatmap && heatmapData.length > 0 && (
                      <HeatmapLayer
                        data={heatmapData.map((d) => d.location)}
                        options={{ radius: 40, opacity: 0.6 }}
                      />
                    )}

                    {/* Collateral Markers */}
                    {filtered.map((pin) => (
                      <Marker
                        key={pin.id}
                        position={{ lat: pin.lat, lng: pin.lng }}
                        icon={getMarkerIcon(pin, selectedPin?.id === pin.id)}
                        onClick={() => setSelectedPin(pin)}
                        title={`${pin.collateralId} — ${pin.obligor}`}
                      >
                        {selectedPin?.id === pin.id && (
                          <InfoWindow
                            onCloseClick={() => setSelectedPin(null)}
                          >
                            <div className="text-xs min-w-[160px]">
                              <p className="font-700 text-sm text-gray-900 mb-1">{pin.collateralId}</p>
                              <p className="text-gray-600 mb-0.5">{pin.obligor}</p>
                              <p className="text-gray-500 mb-1">{pin.address}</p>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-600 ${statusColors[pin.status]}`}>{pin.status}</span>
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-600" style={{ backgroundColor: riskZoneConfig[pin.riskZone].markerColor + '20', color: riskZoneConfig[pin.riskZone].markerColor }}>
                                  {pin.riskZone} Risk
                                </span>
                              </div>
                              <p className="text-gray-500 mt-1 font-mono text-xs">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</p>
                            </div>
                          </InfoWindow>
                        )}
                      </Marker>
                    ))}

                    {/* Geocode result marker */}
                    {geocodeResult && (
                      <Marker
                        position={{ lat: geocodeResult.lat, lng: geocodeResult.lng }}
                        icon={{
                          path: google.maps.SymbolPath.CIRCLE,
                          fillColor: '#0ea5e9',
                          fillOpacity: 1,
                          strokeColor: '#ffffff',
                          strokeWeight: 2,
                          scale: 8,
                        }}
                        title={geocodeResult.address}
                      />
                    )}
                  </GoogleMap>
                )}
              </div>

              {/* Pin Detail Panel */}
              <div className="w-64 shrink-0 overflow-y-auto">
                {selectedPin ? (
                  <div className="bg-white border border-border rounded-xl p-4 shadow-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-700 text-foreground">{selectedPin.collateralId}</p>
                        <p className="text-xs text-muted-foreground">{selectedPin.titleDeed}</p>
                      </div>
                      <button onClick={() => setSelectedPin(null)} className="text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-xs text-muted-foreground">Obligor</p>
                        <p className="text-sm font-500 text-foreground">{selectedPin.obligor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Address</p>
                        <p className="text-sm font-500 text-foreground">{selectedPin.address}</p>
                        {!selectedPin.addressVerified && (
                          <span className="text-xs text-amber-600 font-500">⚠ Address not verified</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coordinates</p>
                        <p className="text-xs font-mono text-foreground">{selectedPin.lat.toFixed(4)}, {selectedPin.lng.toFixed(4)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${statusColors[selectedPin.status]}`}>{selectedPin.status}</span>
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${riskZoneConfig[selectedPin.riskZone].bg} ${riskZoneConfig[selectedPin.riskZone].color} ${riskZoneConfig[selectedPin.riskZone].border}`}>
                          {selectedPin.riskZone} Risk
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Utilization</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${selectedPin.utilization > 80 ? 'bg-red-500' : selectedPin.utilization > 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${selectedPin.utilization}%` }} />
                          </div>
                          <span className="text-xs font-700">{selectedPin.utilization}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Value (TZS)</p>
                        <p className="text-sm font-600 text-foreground">{selectedPin.valueTZS}</p>
                      </div>
                      {/* Geocode button for unverified */}
                      {!selectedPin.addressVerified && isLoaded && (
                        <button
                          onClick={() => geocodePin(selectedPin)}
                          disabled={geocodingStatus[selectedPin.id] === 'loading'}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                        >
                          {geocodingStatus[selectedPin.id] === 'loading' ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Navigation size={11} />
                          )}
                          {geocodingStatus[selectedPin.id] === 'done' ? 'Geocoded ✓' : 'Geocode Address'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground p-4">
                    <MapPin size={28} className="mb-2 opacity-30" />
                    <p className="text-xs">Click a pin on the map to view collateral details</p>
                  </div>
                )}

                {/* Pin List */}
                <div className="mt-3 space-y-1.5">
                  {filtered.map((pin) => {
                    const rz = riskZoneConfig[pin.riskZone];
                    return (
                      <button
                        key={pin.id}
                        onClick={() => {
                          setSelectedPin(pin);
                          if (mapRef.current) {
                            mapRef.current.panTo({ lat: pin.lat, lng: pin.lng });
                            mapRef.current.setZoom(12);
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${selectedPin?.id === pin.id ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-muted/30'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${rz.dot}`} />
                          <span className="font-600 text-foreground">{pin.collateralId}</span>
                          {!pin.addressVerified && <span className="ml-auto text-amber-500">⚠</span>}
                        </div>
                        <p className="text-muted-foreground truncate">{pin.obligor}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'validation' && (
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-700 text-foreground mb-1">Borrower Address Validation</h3>
                <p className="text-xs text-muted-foreground">Comparing borrower address from ID document against collateral registration address using Google Maps Geocoding</p>
              </div>
              {isLoaded && (
                <button
                  onClick={validateAllAddresses}
                  disabled={validatingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                >
                  {validatingAll ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Re-validate All
                </button>
              )}
            </div>
            <div className="space-y-3">
              {validations.map((v) => (
                <div key={v.collateralId} className={`p-4 rounded-xl border shadow-card ${v.flagged ? 'bg-red-50 border-red-200' : 'bg-white border-border'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-700 text-foreground">{v.collateralId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${matchTypeColors[v.matchType]}`}>{v.matchType}</span>
                        {v.flagged && <span className="text-xs font-600 text-red-600">⚠ Flagged for review</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Match Score</p>
                      <p className={`text-xl font-700 tabular-nums font-mono ${v.matchScore >= 80 ? 'text-green-600' : v.matchScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{v.matchScore}%</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">ID Document Address</p>
                      <p className="text-sm text-foreground">{v.idAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Collateral Address</p>
                      <p className="text-sm text-foreground">{v.collateralAddress}</p>
                    </div>
                  </div>
                  {v.geocodedLat && v.geocodedLng && (
                    <div className="mt-2 text-xs text-muted-foreground font-mono">
                      Geocoded: {v.geocodedLat.toFixed(4)}, {v.geocodedLng.toFixed(4)}
                    </div>
                  )}
                  {!v.sameRegion && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600 font-500">
                      <AlertTriangle size={12} />
                      Addresses are in different regions — manual review required
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-700 text-foreground mb-1">Geographic Risk Zone Analysis</h3>
              <p className="text-xs text-muted-foreground">Collateral exposure by risk zone (flood, conflict, environmental hazard)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {(['LOW', 'MEDIUM', 'HIGH'] as RiskZone[]).map((zone) => {
                const count = pins.filter((p) => p.riskZone === zone).length;
                const conf = riskZoneConfig[zone];
                return (
                  <div key={zone} className={`rounded-xl p-4 border ${conf.bg} ${conf.border}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-3 h-3 rounded-full ${conf.dot}`} />
                      <p className={`text-sm font-700 ${conf.color}`}>{zone} Risk</p>
                    </div>
                    <p className={`text-3xl font-700 tabular-nums font-mono ${conf.color}`}>{count}</p>
                    <p className="text-xs text-muted-foreground mt-1">collateral items</p>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider">High Risk Collateral</h4>
              {pins.filter((p) => p.riskZone === 'HIGH').map((pin) => (
                <div key={pin.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
                  <AlertTriangle size={15} className="text-red-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-600 text-foreground">{pin.collateralId} — {pin.obligor}</p>
                    <p className="text-xs text-muted-foreground">{pin.address} · {pin.type}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Utilization</p>
                    <p className="text-sm font-700 text-red-600">{pin.utilization}%</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Risk zones are sourced from external risk APIs and static GIS data. High-risk collateral may require additional LTV adjustments or supplementary collateral. Google Maps Geocoding powers address validation and coordinate resolution.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
