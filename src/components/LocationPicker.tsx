'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { MapPin, Search, X, Loader2, Navigation, CheckCircle2 } from 'lucide-react';

interface LocationValue {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  value: LocationValue | null;
  onChange: (val: LocationValue | null) => void;
}

const TANZANIA_CENTER = { lat: -6.3690, lng: 34.8888 };

async function nominatimGeocode(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=tz`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'CollateralMS/1.0' } });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
    }
    // Retry without country restriction if no results
    const url2 = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res2 = await fetch(url2, { headers: { 'Accept-Language': 'en', 'User-Agent': 'CollateralMS/1.0' } });
    const data2 = await res2.json();
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon), displayName: data2[0].display_name };
    }
    return null;
  } catch {
    return null;
  }
}

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [mode, setMode] = useState<'search' | 'manual'>('search');

  useEffect(() => {
    if (value) {
      setManualLat(String(value.lat));
      setManualLng(String(value.lng));
    }
  }, [value]);

  const handleGeocode = useCallback(async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchError(null);
    const result = await nominatimGeocode(searchText);
    if (result) {
      onChange({ lat: result.lat, lng: result.lng, address: result.displayName });
      setOpen(false);
      setSearchText('');
    } else {
      setSearchError('Address not found. Try a more specific address or use coordinate entry.');
    }
    setSearching(false);
  }, [searchText, onChange]);

  const handleManualSave = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      setSearchError('Enter valid numeric coordinates.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setSearchError('Coordinates out of range.');
      return;
    }
    onChange({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    setOpen(false);
    setSearchError(null);
  };

  return (
    <div className="space-y-2">
      {/* Current value display */}
      {value ? (
        <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-600 text-green-800 truncate">{value.address}</p>
            <p className="text-[10px] text-green-700 font-mono">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-0.5 rounded hover:bg-green-100 text-green-600 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border rounded-lg">
          <MapPin size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">No location set</span>
        </div>
      )}

      {/* OSM static map preview when value is set */}
      {value && (
        <div className="rounded-lg overflow-hidden border border-border" style={{ height: 160 }}>
          <iframe
            title="Collateral Location Preview"
            width="100%"
            height="160"
            style={{ border: 0 }}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - 0.01},${value.lat - 0.01},${value.lng + 0.01},${value.lat + 0.01}&layer=mapnik&marker=${value.lat},${value.lng}`}
          />
        </div>
      )}

      {/* Set / Change button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-500 border border-border rounded-lg hover:bg-muted transition-colors text-foreground w-full justify-center"
      >
        <MapPin size={13} className="text-primary" />
        {value ? 'Change Location' : 'Set Location'}
      </button>

      {/* Picker Modal */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <h3 className="text-base font-700 text-foreground">Set Collateral Location</h3>
              </div>
              <button onClick={() => { setOpen(false); setSearchError(null); }} className="p-1.5 rounded-md hover:bg-muted">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {(['search', 'manual'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setSearchError(null); }}
                    className={`flex-1 py-1.5 text-xs font-600 rounded-md transition-colors ${
                      mode === m ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m === 'search' ? 'Search Address' : 'Enter Coordinates'}
                  </button>
                ))}
              </div>

              {mode === 'search' ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Powered by OpenStreetMap Nominatim — no API key required.</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
                        placeholder="e.g. Plot 245, Kinondoni, Dar es Salaam"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGeocode}
                      disabled={searching || !searchText.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {searching ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                      {searching ? 'Searching…' : 'Find'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Enter decimal coordinates (e.g. -6.7924, 39.2083)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-600 text-foreground mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="-6.7924"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-600 text-foreground mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder="39.2083"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSave}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <MapPin size={13} />
                    Save Coordinates
                  </button>
                </div>
              )}

              {searchError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{searchError}</p>
              )}

              {/* Current value */}
              {value && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs font-600 text-green-800">Current location:</p>
                  <p className="text-xs text-green-700 mt-0.5">{value.address}</p>
                  <p className="text-[10px] text-green-600 font-mono mt-0.5">{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
