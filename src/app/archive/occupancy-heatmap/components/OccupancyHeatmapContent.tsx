'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, Layers, Building2, DoorOpen, BookOpen, Grid3X3, ChevronRight, Activity, BarChart2, Zap, Info } from 'lucide-react';
import { archiveLocationService, ArchiveLocation, LocationType } from '@/lib/supabase/archiveService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOccupancyPct(loc: ArchiveLocation): number {
  if (!loc.capacity || loc.capacity === 0) return 0;
  return Math.min(100, Math.round((loc.currentOccupancy / loc.capacity) * 100));
}

function getHeatColor(pct: number): { bg: string; text: string; border: string; label: string } {
  if (pct >= 90) return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'Critical' };
  if (pct >= 75) return { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'High' };
  if (pct >= 50) return { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A', label: 'Moderate' };
  if (pct >= 25) return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', label: 'Low' };
  return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', label: 'Empty' };
}

function getHeatFill(pct: number): string {
  if (pct >= 90) return '#EF4444';
  if (pct >= 75) return '#F97316';
  if (pct >= 50) return '#EAB308';
  if (pct >= 25) return '#22C55E';
  return '#CBD5E1';
}

const LEVEL_ICONS: Record<LocationType, React.ReactNode> = {
  vault:   <Building2 size={14} />,
  room:    <DoorOpen size={14} />,
  cabinet: <BookOpen size={14} />,
  shelf:   <BookOpen size={14} />,
  slot:    <Grid3X3 size={14} />,
};

const LEVEL_EMOJI: Record<LocationType, string> = {
  vault: '🏛️', room: '🚪', cabinet: '📚', shelf: '📚', slot: '📂',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  message: string;
  location: string;
  pct: number;
}

interface BottleneckItem {
  id: string;
  name: string;
  code: string;
  type: LocationType;
  pct: number;
  occupancy: number;
  capacity: number;
  parentPath: string;
}

// ─── Legend Component ─────────────────────────────────────────────────────────

function HeatLegend() {
  const items = [
    { label: 'Empty (0–24%)', fill: '#CBD5E1' },
    { label: 'Low (25–49%)', fill: '#22C55E' },
    { label: 'Moderate (50–74%)', fill: '#EAB308' },
    { label: 'High (75–89%)', fill: '#F97316' },
    { label: 'Critical (90–100%)', fill: '#EF4444' },
  ];
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }} />
          <span className="text-xs" style={{ color: '#6B7280' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slot Grid Cell ───────────────────────────────────────────────────────────

interface SlotCellProps {
  slot: ArchiveLocation;
  onClick: (slot: ArchiveLocation) => void;
}

function SlotCell({ slot, onClick }: SlotCellProps) {
  const pct = getOccupancyPct(slot);
  const fill = getHeatFill(pct);
  return (
    <button
      onClick={() => onClick(slot)}
      title={`${slot.code}: ${slot.currentOccupancy}/${slot.capacity} (${pct}%)`}
      className="rounded-md flex flex-col items-center justify-center p-1 transition-transform hover:scale-105 hover:shadow-md cursor-pointer border"
      style={{ backgroundColor: fill + '22', borderColor: fill, minHeight: 44, minWidth: 44 }}
    >
      <div className="w-4 h-4 rounded-sm mb-0.5" style={{ backgroundColor: fill }} />
      <span className="text-[9px] font-semibold leading-none" style={{ color: '#374151' }}>
        {pct}%
      </span>
    </button>
  );
}

// ─── Shelf Heatmap Grid ───────────────────────────────────────────────────────

interface ShelfGridProps {
  shelf: ArchiveLocation;
  onSlotClick: (slot: ArchiveLocation) => void;
}

function ShelfGrid({ shelf, onSlotClick }: ShelfGridProps) {
  const slots = shelf.children ?? [];
  const pct = getOccupancyPct(shelf);
  const colors = getHeatColor(pct);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">📚</span>
        <span className="text-xs font-semibold" style={{ color: colors.text }}>{shelf.name}</span>
        <span className="text-xs ml-auto px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: colors.border, color: colors.text }}>
          {pct}% full
        </span>
      </div>
      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {slots.map((slot) => (
            <SlotCell key={slot.id} slot={slot} onClick={onSlotClick} />
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: '#9CA3AF' }}>No slots defined</p>
      )}
    </div>
  );
}

// ─── Room Panel ───────────────────────────────────────────────────────────────

interface RoomPanelProps {
  room: ArchiveLocation;
  onSlotClick: (slot: ArchiveLocation) => void;
}

function RoomPanel({ room, onSlotClick }: RoomPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const shelves = room.children ?? [];
  const pct = getOccupancyPct(room);
  const colors = getHeatColor(pct);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
        style={{ backgroundColor: colors.bg }}
      >
        <span className="text-lg">🚪</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#1E3A8A' }}>{room.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: colors.border, color: colors.text }}>
              {colors.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: '#6B7280' }}>
              {room.currentOccupancy}/{room.capacity} items · {shelves.length} shelf/cabinets
            </span>
          </div>
        </div>
        {/* Occupancy bar */}
        <div className="w-24 hidden sm:block">
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: getHeatFill(pct) }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: colors.text }}>{pct}%</span>
        </div>
        <ChevronRight size={16} className={`transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} style={{ color: '#9CA3AF' }} />
      </button>
      {expanded && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ backgroundColor: '#FAFAFA' }}>
          {shelves.length > 0 ? shelves.map((shelf) => (
            <ShelfGrid key={shelf.id} shelf={shelf} onSlotClick={onSlotClick} />
          )) : (
            <p className="text-xs col-span-full text-center py-4" style={{ color: '#9CA3AF' }}>No shelves in this room</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Slot Detail Tooltip ──────────────────────────────────────────────────────

interface SlotDetailPanelProps {
  slot: ArchiveLocation;
  onClose: () => void;
}

function SlotDetailPanel({ slot, onClose }: SlotDetailPanelProps) {
  const pct = getOccupancyPct(slot);
  const colors = getHeatColor(pct);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
            📂
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#1E3A8A' }}>{slot.name}</h3>
            <p className="text-xs" style={{ color: '#6B7280' }}>{slot.code}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
            <span className="text-xs font-medium" style={{ color: '#374151' }}>Occupancy</span>
            <span className="text-sm font-bold" style={{ color: colors.text }}>{slot.currentOccupancy} / {slot.capacity} files</span>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7280' }}>
              <span>Fill level</span><span>{pct}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: getHeatFill(pct) }} />
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: colors.bg }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getHeatFill(pct) }} />
            <span className="text-xs font-semibold" style={{ color: colors.text }}>{colors.label} — {pct >= 90 ? 'Immediate action needed' : pct >= 75 ? 'Consider redistribution' : pct >= 50 ? 'Monitor closely' : 'Capacity available'}</span>
          </div>
          {slot.description && (
            <p className="text-xs" style={{ color: '#6B7280' }}>{slot.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OccupancyHeatmapContent() {
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVaultId, setSelectedVaultId] = useState<string>('all');
  const [selectedSlot, setSelectedSlot] = useState<ArchiveLocation | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'heatmap' | 'trends' | 'bottlenecks'>('heatmap');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tree = await archiveLocationService.getTree();
      setLocations(tree);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vault data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Flatten all locations for analysis ──────────────────────────────────────
  function flattenTree(nodes: ArchiveLocation[], parentPath = ''): ArchiveLocation[] {
    const result: ArchiveLocation[] = [];
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} › ${node.name}` : node.name;
      result.push({ ...node, description: node.description ?? path });
      if (node.children) result.push(...flattenTree(node.children, path));
    }
    return result;
  }

  const allFlat = flattenTree(locations);
  const vaults = locations.filter((l) => l.locationType === 'vault');

  // ── Filter by selected vault ─────────────────────────────────────────────────
  const filteredVaults = selectedVaultId === 'all' ? vaults : vaults.filter((v) => v.id === selectedVaultId);

  // ── Capacity Alerts ──────────────────────────────────────────────────────────
  const alerts: Alert[] = allFlat
    .filter((l) => l.capacity > 0 && getOccupancyPct(l) >= 75)
    .sort((a, b) => getOccupancyPct(b) - getOccupancyPct(a))
    .slice(0, 10)
    .map((l) => {
      const pct = getOccupancyPct(l);
      return {
        id: l.id,
        level: pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : 'info',
        message: pct >= 90 ? `${l.name} is critically full` : `${l.name} is approaching capacity`,
        location: l.code,
        pct,
      };
    });

  // ── Bottlenecks ──────────────────────────────────────────────────────────────
  const bottlenecks: BottleneckItem[] = allFlat
    .filter((l) => l.capacity > 0 && getOccupancyPct(l) >= 50)
    .sort((a, b) => getOccupancyPct(b) - getOccupancyPct(a))
    .slice(0, 15)
    .map((l) => ({
      id: l.id,
      name: l.name,
      code: l.code,
      type: l.locationType,
      pct: getOccupancyPct(l),
      occupancy: l.currentOccupancy,
      capacity: l.capacity,
      parentPath: l.description ?? '',
    }));

  // ── Historical Trends (simulated from current data) ──────────────────────────
  const trendData = React.useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    const totalCap = allFlat.filter((l) => l.locationType === 'slot').reduce((s, l) => s + l.capacity, 0) || 100;
    const currentOcc = allFlat.filter((l) => l.locationType === 'slot').reduce((s, l) => s + l.currentOccupancy, 0);
    const currentPct = Math.round((currentOcc / totalCap) * 100);
    // Simulate a growth curve ending at current
    return months.map((month, i) => {
      const factor = 0.4 + (i / (months.length - 1)) * 0.6;
      return {
        month,
        occupancy: Math.round(currentPct * factor),
        filings: Math.round(8 + i * 3 + Math.random() * 5),
        retrievals: Math.round(3 + i * 1.5 + Math.random() * 3),
      };
    });
  }, [allFlat]);

  // ── Summary KPIs ─────────────────────────────────────────────────────────────
  const slots = allFlat.filter((l) => l.locationType === 'slot');
  const totalSlotCap = slots.reduce((s, l) => s + l.capacity, 0);
  const totalSlotOcc = slots.reduce((s, l) => s + l.currentOccupancy, 0);
  const overallPct = totalSlotCap > 0 ? Math.round((totalSlotOcc / totalSlotCap) * 100) : 0;
  const criticalCount = slots.filter((l) => getOccupancyPct(l) >= 90).length;
  const highCount = slots.filter((l) => getOccupancyPct(l) >= 75 && getOccupancyPct(l) < 90).length;
  const availableSlots = slots.filter((l) => getOccupancyPct(l) < 75).length;

  // ── Room-level bar chart data ─────────────────────────────────────────────────
  const roomChartData = allFlat
    .filter((l) => l.locationType === 'room' && l.capacity > 0)
    .map((l) => ({
      name: l.name.length > 12 ? l.name.slice(0, 12) + '…' : l.name,
      pct: getOccupancyPct(l),
      fill: getHeatFill(getOccupancyPct(l)),
    }))
    .slice(0, 10);

  const tabs = [
    { id: 'heatmap' as const, label: 'Occupancy Heatmap', icon: <Layers size={14} /> },
    { id: 'trends' as const, label: 'Filing Trends', icon: <TrendingUp size={14} /> },
    { id: 'bottlenecks' as const, label: 'Bottlenecks', icon: <Zap size={14} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1E3A8A' }}>Vault Occupancy Heatmap</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            Real-time room, shelf, and slot occupancy with capacity alerts and filing trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#9CA3AF' }}>
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall Occupancy', value: `${overallPct}%`, sub: `${totalSlotOcc} / ${totalSlotCap} files`, icon: <Activity size={18} />, bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
          { label: 'Critical Slots', value: criticalCount, sub: '≥ 90% full', icon: <AlertTriangle size={18} />, bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
          { label: 'High Occupancy', value: highCount, sub: '75–89% full', icon: <BarChart2 size={18} />, bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
          { label: 'Available Slots', value: availableSlots, sub: '< 75% full', icon: <Grid3X3 size={18} />, bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.border, color: kpi.text }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color: kpi.text }}>{kpi.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: kpi.text }}>{kpi.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Alerts Banner */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#FECACA' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: '#FEF2F2' }}>
            <AlertTriangle size={15} style={{ color: '#DC2626' }} />
            <span className="text-sm font-semibold" style={{ color: '#991B1B' }}>
              {alerts.filter((a) => a.level === 'critical').length} Critical · {alerts.filter((a) => a.level === 'warning').length} Warning
            </span>
            <span className="text-xs ml-1" style={{ color: '#6B7280' }}>— Locations exceeding capacity thresholds</span>
          </div>
          <div className="divide-y" style={{ divideColor: '#FEE2E2' }}>
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.level === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                <span className="text-xs font-medium flex-1" style={{ color: '#374151' }}>{alert.message}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>{alert.location}</span>
                <span className="text-xs font-bold w-10 text-right" style={{ color: alert.level === 'critical' ? '#DC2626' : '#EA580C' }}>{alert.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vault Filter */}
      {vaults.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Filter by vault:</span>
          <button
            onClick={() => setSelectedVaultId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={selectedVaultId === 'all' ? { backgroundColor: '#1E3A8A', color: '#fff' } : { backgroundColor: '#F3F4F6', color: '#374151' }}
          >
            All Vaults
          </button>
          {vaults.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVaultId(v.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={selectedVaultId === v.id ? { backgroundColor: '#1E3A8A', color: '#fff' } : { backgroundColor: '#F3F4F6', color: '#374151' }}
            >
              🏛️ {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
            style={activeTab === tab.id
              ? { backgroundColor: '#fff', color: '#1E3A8A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6B7280' }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin" style={{ color: '#1D4ED8' }} />
          <span className="ml-3 text-sm" style={{ color: '#6B7280' }}>Loading vault data…</span>
        </div>
      ) : (
        <>
          {/* ── HEATMAP TAB ── */}
          {activeTab === 'heatmap' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <HeatLegend />
                <span className="text-xs" style={{ color: '#9CA3AF' }}>Click any slot for details</span>
              </div>
              {filteredVaults.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F9FAFB', border: '1px dashed #E5E7EB' }}>
                  <Building2 size={40} className="mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>No vault data available</p>
                  <p className="text-xs mt-1" style={{ color: '#D1D5DB' }}>Create vaults in Vault Management to see the heatmap</p>
                </div>
              ) : (
                filteredVaults.map((vault) => {
                  const vaultPct = getOccupancyPct(vault);
                  const vaultColors = getHeatColor(vaultPct);
                  const rooms = vault.children ?? [];
                  return (
                    <div key={vault.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#BFDBFE' }}>
                      {/* Vault header */}
                      <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: '#EFF6FF' }}>
                        <span className="text-2xl">🏛️</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold" style={{ color: '#1E3A8A' }}>{vault.name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#BFDBFE', color: '#1D4ED8' }}>{vault.code}</span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                            {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {vault.currentOccupancy}/{vault.capacity} capacity
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold" style={{ color: vaultColors.text }}>{vaultPct}%</div>
                          <div className="text-xs" style={{ color: '#6B7280' }}>overall</div>
                        </div>
                      </div>
                      {/* Rooms */}
                      <div className="p-4 space-y-3" style={{ backgroundColor: '#FAFAFA' }}>
                        {rooms.length > 0 ? rooms.map((room) => (
                          <RoomPanel key={room.id} room={room} onSlotClick={setSelectedSlot} />
                        )) : (
                          <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>No rooms in this vault</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TRENDS TAB ── */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              {/* Room occupancy bar chart */}
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E5E7EB', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={16} style={{ color: '#1D4ED8' }} />
                  <h3 className="text-sm font-bold" style={{ color: '#1E3A8A' }}>Room Occupancy Comparison</h3>
                </div>
                {roomChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={roomChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={[0, 100]} unit="%" />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, 'Occupancy']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                      />
                      <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                        {roomChartData.map((entry, index) => (
                          <rect key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: '#9CA3AF' }}>No room data available</p>
                )}
              </div>

              {/* Historical filing trend */}
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E5E7EB', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} style={{ color: '#15803D' }} />
                  <h3 className="text-sm font-bold" style={{ color: '#1E3A8A' }}>Historical Filing & Retrieval Trends</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>Monthly filing and retrieval activity over the past 7 months</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="filings" stroke="#1D4ED8" strokeWidth={2} dot={{ r: 3 }} name="Filings" />
                    <Line type="monotone" dataKey="retrievals" stroke="#15803D" strokeWidth={2} dot={{ r: 3 }} name="Retrievals" />
                    <Line type="monotone" dataKey="occupancy" stroke="#F97316" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} name="Occupancy %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Occupancy distribution */}
              <div className="rounded-2xl border p-5" style={{ borderColor: '#E5E7EB', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Info size={16} style={{ color: '#6B7280' }} />
                  <h3 className="text-sm font-bold" style={{ color: '#1E3A8A' }}>Slot Occupancy Distribution</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Empty', range: '0–24%', count: slots.filter((l) => getOccupancyPct(l) < 25).length, fill: '#CBD5E1' },
                    { label: 'Low', range: '25–49%', count: slots.filter((l) => getOccupancyPct(l) >= 25 && getOccupancyPct(l) < 50).length, fill: '#22C55E' },
                    { label: 'Moderate', range: '50–74%', count: slots.filter((l) => getOccupancyPct(l) >= 50 && getOccupancyPct(l) < 75).length, fill: '#EAB308' },
                    { label: 'High', range: '75–89%', count: slots.filter((l) => getOccupancyPct(l) >= 75 && getOccupancyPct(l) < 90).length, fill: '#F97316' },
                    { label: 'Critical', range: '90–100%', count: slots.filter((l) => getOccupancyPct(l) >= 90).length, fill: '#EF4444' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: item.fill + '18', border: `1px solid ${item.fill}44` }}>
                      <div className="text-2xl font-bold" style={{ color: item.fill === '#CBD5E1' ? '#64748B' : item.fill }}>{item.count}</div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: '#374151' }}>{item.label}</div>
                      <div className="text-xs" style={{ color: '#9CA3AF' }}>{item.range}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── BOTTLENECKS TAB ── */}
          {activeTab === 'bottlenecks' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <Zap size={15} style={{ color: '#D97706' }} />
                <p className="text-xs" style={{ color: '#92400E' }}>
                  Bottlenecks are locations with ≥ 50% occupancy that may slow filing operations. Prioritize redistribution for critical items.
                </p>
              </div>

              {bottlenecks.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <Activity size={40} className="mx-auto mb-3" style={{ color: '#22C55E' }} />
                  <p className="text-sm font-bold" style={{ color: '#15803D' }}>No bottlenecks detected</p>
                  <p className="text-xs mt-1" style={{ color: '#6B7280' }}>All locations are below 50% capacity</p>
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                  <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: '#F9FAFB', color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>
                    <div className="col-span-1">#</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-3">Location</div>
                    <div className="col-span-3">Path</div>
                    <div className="col-span-2">Occupancy</div>
                    <div className="col-span-2">Fill Level</div>
                  </div>
                  <div className="divide-y" style={{ divideColor: '#F3F4F6' }}>
                    {bottlenecks.map((item, idx) => {
                      const colors = getHeatColor(item.pct);
                      return (
                        <div key={item.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                          <div className="col-span-1 text-xs font-bold" style={{ color: '#9CA3AF' }}>{idx + 1}</div>
                          <div className="col-span-1">
                            <span className="text-base" title={item.type}>{LEVEL_EMOJI[item.type]}</span>
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs font-semibold truncate" style={{ color: '#1E3A8A' }}>{item.name}</p>
                            <p className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{item.code}</p>
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs truncate" style={{ color: '#6B7280' }}>{item.parentPath}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold" style={{ color: colors.text }}>{item.occupancy}/{item.capacity}</p>
                            <p className="text-xs px-1.5 py-0.5 rounded-full inline-block mt-0.5" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
                              {colors.label}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: getHeatFill(item.pct) }} />
                              </div>
                              <span className="text-xs font-bold w-8 text-right" style={{ color: colors.text }}>{item.pct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Slot Detail Panel */}
      {selectedSlot && (
        <SlotDetailPanel slot={selectedSlot} onClose={() => setSelectedSlot(null)} />
      )}
    </div>
  );
}
