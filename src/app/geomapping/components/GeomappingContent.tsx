'use client';
import React, { useState } from 'react';
import { Map, MapPin, AlertTriangle, CheckCircle2, Search, Navigation, Layers, Info, Shield, X,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


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
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockPins: CollateralPin[] = [
  { id: '1', collateralId: 'COL-2024-0891', titleDeed: 'TD-00123', obligor: 'Tanzanian Steel Industries', type: 'Land & Property', status: 'Perfected', lat: -6.7924, lng: 39.2083, address: 'Ohio Street, Dar es Salaam', addressVerified: true, riskZone: 'LOW', utilization: 72.5, valueTZS: '2,500,000,000', region: 'Dar es Salaam' },
  { id: '2', collateralId: 'COL-2024-0756', titleDeed: 'TD-00456', obligor: 'Kilimanjaro Coffee Exporters', type: 'Land & Property', status: 'Under Review', lat: -3.3731, lng: 36.6823, address: 'Moshi Town, Kilimanjaro', addressVerified: true, riskZone: 'LOW', utilization: 55.0, valueTZS: '850,000,000', region: 'Kilimanjaro' },
  { id: '3', collateralId: 'COL-2024-0612', titleDeed: 'TD-00789', obligor: 'Dar es Salaam Logistics Co.', type: 'Motor Vehicles', status: 'Perfected', lat: -6.8160, lng: 39.2803, address: 'Temeke, Dar es Salaam', addressVerified: false, riskZone: 'MEDIUM', utilization: 88.3, valueTZS: '320,000,000', region: 'Dar es Salaam' },
  { id: '4', collateralId: 'COL-2024-0534', titleDeed: 'TD-01012', obligor: 'Mwanza Fish Processing Ltd', type: 'Equipment', status: 'Overdue', lat: -2.5164, lng: 32.9175, address: 'Mwanza City Centre', addressVerified: true, riskZone: 'HIGH', utilization: 95.1, valueTZS: '180,000,000', region: 'Mwanza' },
  { id: '5', collateralId: 'COL-2024-0489', titleDeed: 'TD-01345', obligor: 'Arusha New Ventures Ltd', type: 'Land & Property', status: 'Submitted', lat: -3.3869, lng: 36.6830, address: 'Arusha CBD', addressVerified: true, riskZone: 'LOW', utilization: 60.0, valueTZS: '1,200,000,000', region: 'Arusha' },
  { id: '6', collateralId: 'COL-2024-0321', titleDeed: 'TD-01678', obligor: 'Dodoma Grain Traders', type: 'Land & Property', status: 'Perfected', lat: -6.1722, lng: 35.7395, address: 'Dodoma Capital Area', addressVerified: true, riskZone: 'MEDIUM', utilization: 45.2, valueTZS: '650,000,000', region: 'Dodoma' },
  { id: '7', collateralId: 'COL-2024-0290', titleDeed: 'TD-02001', obligor: 'Zanzibar Spice Exports', type: 'Land & Property', status: 'Draft', lat: -6.1659, lng: 39.2026, address: 'Stone Town, Zanzibar', addressVerified: false, riskZone: 'HIGH', utilization: 0, valueTZS: '420,000,000', region: 'Zanzibar' },
];

const mockValidations: AddressValidation[] = [
  { collateralId: 'COL-2024-0891', idAddress: 'Ohio Street, Dar es Salaam', collateralAddress: 'Ohio Street, Dar es Salaam', matchScore: 100, matchType: 'EXACT', sameRegion: true, flagged: false },
  { collateralId: 'COL-2024-0612', idAddress: 'Temeke District, DSM', collateralAddress: 'Temeke, Dar es Salaam', matchScore: 78, matchType: 'PARTIAL', sameRegion: true, flagged: false },
  { collateralId: 'COL-2024-0534', idAddress: 'Dar es Salaam', collateralAddress: 'Mwanza City Centre', matchScore: 12, matchType: 'MISMATCH', sameRegion: false, flagged: true },
  { collateralId: 'COL-2024-0290', idAddress: 'Dar es Salaam', collateralAddress: 'Stone Town, Zanzibar', matchScore: 25, matchType: 'MISMATCH', sameRegion: false, flagged: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const riskZoneConfig: Record<RiskZone, { color: string; bg: string; border: string; dot: string }> = {
  LOW: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  HIGH: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
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

// ─── Map Placeholder ──────────────────────────────────────────────────────────

function MapPlaceholder({ pins, selectedPin, onSelectPin }: {
  pins: CollateralPin[];
  selectedPin: CollateralPin | null;
  onSelectPin: (p: CollateralPin) => void;
}) {
  // Simulate a map with positioned pins on a Tanzania outline background
  const regions: Record<string, { x: number; y: number }> = {
    'Dar es Salaam': { x: 82, y: 62 },
    'Kilimanjaro': { x: 72, y: 28 },
    'Mwanza': { x: 32, y: 38 },
    'Arusha': { x: 62, y: 25 },
    'Dodoma': { x: 55, y: 50 },
    'Zanzibar': { x: 88, y: 58 },
  };

  const riskColors: Record<RiskZone, string> = {
    LOW: '#22c55e',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 rounded-xl overflow-hidden border border-border">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Tanzania label */}
      <div className="absolute top-3 left-3 text-xs font-600 text-muted-foreground bg-white/80 px-2 py-1 rounded-md border border-border">
        Tanzania — Interactive Map View
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 border border-border rounded-lg p-2 text-xs">
        <p className="font-600 text-foreground mb-1.5">Risk Zones</p>
        {(['LOW', 'MEDIUM', 'HIGH'] as RiskZone[]).map((zone) => (
          <div key={zone} className="flex items-center gap-1.5 mb-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: riskColors[zone] }} />
            <span className="text-muted-foreground">{zone}</span>
          </div>
        ))}
      </div>

      {/* Pins */}
      {pins.map((pin) => {
        const pos = regions[pin.region] || { x: 50, y: 50 };
        const isSelected = selectedPin?.id === pin.id;
        return (
          <button
            key={pin.id}
            onClick={() => onSelectPin(pin)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div className={`relative flex items-center justify-center transition-transform ${isSelected ? 'scale-150' : 'hover:scale-125'}`}>
              <MapPin
                size={isSelected ? 28 : 22}
                style={{ color: riskColors[pin.riskZone] }}
                fill={riskColors[pin.riskZone]}
                className="drop-shadow-md"
              />
              {!pin.addressVerified && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border border-white" />
              )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-foreground text-white text-xs px-2 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                <p className="font-600">{pin.collateralId}</p>
                <p className="opacity-80">{pin.obligor}</p>
              </div>
            </div>
          </button>
        );
      })}

      {/* Heatmap overlay hint */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-500 text-muted-foreground bg-white/80 px-2 py-1 rounded-md border border-border">
        <Layers size={12} />
        Heatmap overlay available
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GeomappingContent() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const [selectedPin, setSelectedPin] = useState<CollateralPin | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'validation' | 'risk'>('map');

  const filtered = mockPins.filter((p) => {
    const matchSearch = !search || p.collateralId.toLowerCase().includes(search.toLowerCase()) || p.obligor.toLowerCase().includes(search.toLowerCase()) || p.region.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || p.type === typeFilter;
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchRisk = riskFilter === 'All' || p.riskZone === riskFilter;
    return matchSearch && matchType && matchStatus && matchRisk;
  });

  const highRisk = mockPins.filter((p) => p.riskZone === 'HIGH').length;
  const unverified = mockPins.filter((p) => !p.addressVerified).length;
  const flagged = mockValidations.filter((v) => v.flagged).length;

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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Mapped', value: mockPins.length, sub: 'Collateral with coordinates', icon: MapPin, variant: 'default' as const },
          { label: 'High Risk Zones', value: highRisk, sub: 'Flood/conflict areas', icon: AlertTriangle, variant: 'danger' as const },
          { label: 'Unverified Addresses', value: unverified, sub: 'Address not validated', icon: Navigation, variant: 'warning' as const },
          { label: 'Address Mismatches', value: flagged, sub: 'ID vs collateral address', icon: Shield, variant: 'danger' as const },
        ].map(({ label, value, sub, icon: Icon, variant }) => {
          const bg = { default: 'bg-white border-border', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200' };
          const iconBg = { default: 'bg-primary/10 text-primary', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600' };
          const valColor = { default: 'text-foreground', danger: 'text-red-700', warning: 'text-amber-700' };
          return (
            <div key={label} className={`rounded-xl p-4 border shadow-card ${bg[variant]}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
                  <Icon size={15} />
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
            </div>

            <div className="flex gap-4 h-[420px]">
              {/* Map */}
              <div className="flex-1">
                <MapPlaceholder pins={filtered} selectedPin={selectedPin} onSelectPin={setSelectedPin} />
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
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
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
                        onClick={() => setSelectedPin(pin)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${selectedPin?.id === pin.id ? 'border-primary bg-primary/5' : 'border-border bg-white hover:bg-muted/30'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-2 h-2 rounded-full ${rz.dot}`} />
                          <span className="font-600 text-foreground">{pin.collateralId}</span>
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
            <div className="mb-4">
              <h3 className="text-sm font-700 text-foreground mb-1">Borrower Address Validation</h3>
              <p className="text-xs text-muted-foreground">Comparing borrower address from ID document against collateral registration address</p>
            </div>
            <div className="space-y-3">
              {mockValidations.map((v) => (
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
                const count = mockPins.filter((p) => p.riskZone === zone).length;
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
              {mockPins.filter((p) => p.riskZone === 'HIGH').map((pin) => (
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
                  Risk zones are sourced from external risk APIs and static GIS data. High-risk collateral may require additional LTV adjustments or supplementary collateral. Integration with PostGIS spatial extension enables advanced proximity and flood zone queries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
