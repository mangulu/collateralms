'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, TrendingUp, Layers, Building2, DoorOpen, BookOpen, Grid3X3, ChevronRight, Activity, BarChart2, Zap, Info } from 'lucide-react';
import { archiveLocationService, archiveAuditService, ArchiveLocation, ArchiveAuditEntry, LocationType } from '@/lib/supabase/archiveService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import StatusBadge from '@/components/ui/StatusBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOccupancyPct(loc: ArchiveLocation): number {
  if (!loc.capacity || loc.capacity === 0) return 0;
  return Math.min(100, Math.round((loc.currentOccupancy / loc.capacity) * 100));
}

function getHeatColor(pct: number): { bg: string; text: string; border: string; label: string } {
  if (pct >= 90) return { bg: 'var(--izou-danger-light)', text: 'var(--izou-danger)', border: 'var(--izou-danger-light)', label: 'Critical' };
  if (pct >= 75) return { bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)', label: 'High' };
  // Kept as its own literal yellow (not a brand token) so this 5-step heatmap
  // keeps a "Moderate" tier visually distinct from "High", which already
  // uses the single warning-orange token.
  if (pct >= 50) return { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A', label: 'Moderate' };
  if (pct >= 25) return { bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)', label: 'Low' };
  return { bg: 'var(--izou-bg)', text: 'var(--izou-muted)', border: 'var(--izou-border)', label: 'Empty' };
}

function getHeatFill(pct: number): string {
  if (pct >= 90) return 'var(--izou-danger)';
  if (pct >= 75) return 'var(--izou-warning)';
  if (pct >= 50) return '#EAB308';
  if (pct >= 25) return 'var(--izou-success)';
  return 'var(--izou-border)';
}

const LEVEL_ICONS: Record<LocationType, React.ReactNode> = {
  vault:   <Building2 size={14} />,
  room:    <DoorOpen size={14} />,
  cabinet: <BookOpen size={14} />,
  slot:    <Grid3X3 size={14} />,
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
    { label: 'Empty (0–24%)', fill: 'var(--izou-border)' },
    { label: 'Low (25–49%)', fill: 'var(--izou-success)' },
    { label: 'Moderate (50–74%)', fill: '#EAB308' },
    { label: 'High (75–89%)', fill: 'var(--izou-warning)' },
    { label: 'Critical (90–100%)', fill: 'var(--izou-danger)' },
  ];
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.fill }} />
          <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>{item.label}</span>
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
      <span className="text-[9px] font-semibold leading-none" style={{ color: 'var(--izou-text)' }}>
        {pct}%
      </span>
    </button>
  );
}

// ─── Cabinet Heatmap Grid ───────────────────────────────────────────────────────

interface CabinetGridProps {
  cabinet: ArchiveLocation;
  onSlotClick: (slot: ArchiveLocation) => void;
}

function CabinetGrid({ cabinet, onSlotClick }: CabinetGridProps) {
  const slots = cabinet.children ?? [];
  const pct = getOccupancyPct(cabinet);
  const colors = getHeatColor(pct);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: colors.text }}>{LEVEL_ICONS.cabinet}</span>
        <span className="text-xs font-semibold" style={{ color: colors.text }}>{cabinet.name}</span>
        <span className="ml-auto">
          <StatusBadge label={`${pct}% full`} bg={colors.border} text={colors.text} />
        </span>
      </div>
      {slots.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {slots.map((slot) => (
            <SlotCell key={slot.id} slot={slot} onClick={onSlotClick} />
          ))}
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>No slots defined</p>
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
  const cabinets = room.children ?? [];
  const pct = getOccupancyPct(room);
  const colors = getHeatColor(pct);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--izou-border)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
        style={{ backgroundColor: colors.bg }}
      >
        <span style={{ color: 'var(--izou-secondary)' }}>{React.cloneElement(LEVEL_ICONS.room as React.ReactElement<{ size?: number }>, { size: 18 })}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>{room.name}</span>
            <StatusBadge label={colors.label} bg={colors.border} text={colors.text} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>
              {room.currentOccupancy}/{room.capacity} items · {cabinets.length} cabinets
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
        <ChevronRight size={16} className={`transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} style={{ color: 'var(--izou-muted)' }} />
      </button>
      {expanded && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ backgroundColor: 'var(--izou-bg)' }}>
          {cabinets.length > 0 ? cabinets.map((cabinet) => (
            <CabinetGrid key={cabinet.id} cabinet={cabinet} onSlotClick={onSlotClick} />
          )) : (
            <p className="text-xs col-span-full text-center py-4" style={{ color: 'var(--izou-muted)' }}>No cabinets in this room</p>
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
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
            {React.cloneElement(LEVEL_ICONS.slot as React.ReactElement<{ size?: number }>, { size: 18 })}
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>{slot.name}</h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{slot.code}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
            <span className="text-xs font-medium" style={{ color: 'var(--izou-text)' }}>Occupancy</span>
            <span className="text-sm font-bold" style={{ color: colors.text }}>{slot.currentOccupancy} / {slot.capacity} files</span>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--izou-muted)' }}>
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
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{slot.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OccupancyHeatmapContent() {
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [auditEntries, setAuditEntries] = useState<ArchiveAuditEntry[]>([]);
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
      const tree = await archiveLocationService.getTreeWithCounts();
      setLocations(tree);
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vault data');
    } finally {
      setLoading(false);
    }
    // Trend data is a secondary chart — don't let it block the primary heatmap view.
    try {
      const audit = await archiveAuditService.getAll(1000);
      setAuditEntries(audit);
    } catch {
      setAuditEntries([]);
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

  // ── Historical Filing & Retrieval Trends (real, from the archive audit log) ──
  const trendData = React.useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      return { year: d.getFullYear(), monthIdx: d.getMonth(), month: d.toLocaleString('en-GB', { month: 'short' }), filings: 0, retrievals: 0 };
    });
    for (const entry of auditEntries) {
      const d = new Date(entry.createdAt);
      const bucket = buckets.find((b) => b.year === d.getFullYear() && b.monthIdx === d.getMonth());
      if (!bucket) continue;
      if (entry.eventType === 'placement_assigned' || entry.eventType === 'collateral_moved') bucket.filings++;
      else if (entry.eventType === 'checked_out' || entry.eventType === 'returned') bucket.retrievals++;
    }
    return buckets.map(({ month, filings, retrievals }) => ({ month, filings, retrievals }));
  }, [auditEntries]);

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--izou-secondary)' }}>Vault Occupancy Heatmap</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--izou-muted)' }}>
            Real-time room, cabinet, and slot occupancy with capacity alerts and filing trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)', border: '1px solid var(--izou-border)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--izou-danger-light)', color: 'var(--izou-danger)', border: '1px solid var(--izou-danger-light)' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Overall Occupancy', value: `${overallPct}%`, sub: `${totalSlotOcc} / ${totalSlotCap} files`, icon: <Activity size={18} />, bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)' },
          { label: 'Critical Slots', value: criticalCount, sub: '≥ 90% full', icon: <AlertTriangle size={18} />, bg: 'var(--izou-danger-light)', text: 'var(--izou-danger)', border: 'var(--izou-danger-light)' },
          { label: 'High Occupancy', value: highCount, sub: '75–89% full', icon: <BarChart2 size={18} />, bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)' },
          { label: 'Available Slots', value: availableSlots, sub: '< 75% full', icon: <Grid3X3 size={18} />, bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.border, color: kpi.text }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-2xl font-bold leading-none" style={{ color: kpi.text }}>{kpi.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: kpi.text }}>{kpi.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Capacity Alerts Banner */}
      {alerts.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--izou-danger-light)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--izou-danger-light)' }}>
            <AlertTriangle size={15} style={{ color: 'var(--izou-danger)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--izou-danger)' }}>
              {alerts.filter((a) => a.level === 'critical').length} Critical · {alerts.filter((a) => a.level === 'warning').length} Warning
            </span>
            <span className="text-xs ml-1" style={{ color: 'var(--izou-muted)' }}>— Locations exceeding capacity thresholds</span>
          </div>
          <div className="divide-y divide-[var(--izou-danger-light)]">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.level === 'critical' ? 'bg-red-500' : 'bg-orange-400'}`} />
                <span className="text-xs font-medium flex-1" style={{ color: 'var(--izou-text)' }}>{alert.message}</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-bg)', color: 'var(--izou-muted)' }}>{alert.location}</span>
                <span className="text-xs font-bold w-10 text-right" style={{ color: alert.level === 'critical' ? 'var(--izou-danger)' : 'var(--izou-warning)' }}>{alert.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vault Filter */}
      {vaults.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium" style={{ color: 'var(--izou-muted)' }}>Filter by vault:</span>
          <button
            onClick={() => setSelectedVaultId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={selectedVaultId === 'all' ? { backgroundColor: 'var(--izou-secondary)', color: '#fff' } : { backgroundColor: 'var(--izou-bg)', color: 'var(--izou-text)' }}
          >
            All Vaults
          </button>
          {vaults.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVaultId(v.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={selectedVaultId === v.id ? { backgroundColor: 'var(--izou-secondary)', color: '#fff' } : { backgroundColor: 'var(--izou-bg)', color: 'var(--izou-text)' }}
            >
              <Building2 size={12} /> {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--izou-bg)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center"
            style={activeTab === tab.id
              ? { backgroundColor: '#fff', color: 'var(--izou-secondary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--izou-muted)' }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--izou-secondary)' }} />
          <span className="ml-3 text-sm" style={{ color: 'var(--izou-muted)' }}>Loading vault data…</span>
        </div>
      ) : (
        <>
          {/* ── HEATMAP TAB ── */}
          {activeTab === 'heatmap' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <HeatLegend />
                <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>Click any slot for details</span>
              </div>
              {filteredVaults.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: 'var(--izou-bg)', border: '1px dashed var(--izou-border)' }}>
                  <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--izou-muted)' }}>No vault data available</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Create vaults in Vault Management to see the heatmap</p>
                </div>
              ) : (
                filteredVaults.map((vault) => {
                  const vaultPct = getOccupancyPct(vault);
                  const vaultColors = getHeatColor(vaultPct);
                  const rooms = vault.children ?? [];
                  return (
                    <div key={vault.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--izou-border)' }}>
                      {/* Vault header */}
                      <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
                        <span style={{ color: 'var(--izou-secondary)' }}>{React.cloneElement(LEVEL_ICONS.vault as React.ReactElement<{ size?: number }>, { size: 24 })}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold" style={{ color: 'var(--izou-secondary)' }}>{vault.name}</span>
                            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' }}>{vault.code}</span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                            {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {vault.currentOccupancy}/{vault.capacity} capacity
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold" style={{ color: vaultColors.text }}>{vaultPct}%</div>
                          <div className="text-xs" style={{ color: 'var(--izou-muted)' }}>overall</div>
                        </div>
                      </div>
                      {/* Rooms */}
                      <div className="p-4 space-y-3" style={{ backgroundColor: 'var(--izou-bg)' }}>
                        {rooms.length > 0 ? rooms.map((room) => (
                          <RoomPanel key={room.id} room={room} onSlotClick={setSelectedSlot} />
                        )) : (
                          <p className="text-xs text-center py-6" style={{ color: 'var(--izou-muted)' }}>No rooms in this vault</p>
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
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--izou-border)', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 size={16} style={{ color: 'var(--izou-secondary)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>Room Occupancy Comparison</h3>
                </div>
                {roomChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={roomChartData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--izou-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--izou-muted)' }} domain={[0, 100]} unit="%" />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, 'Occupancy']}
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--izou-border)', fontSize: 12 }}
                      />
                      <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                        {roomChartData.map((entry, index) => (
                          <rect key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--izou-muted)' }}>No room data available</p>
                )}
              </div>

              {/* Historical filing trend */}
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--izou-border)', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} style={{ color: 'var(--izou-success)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>Historical Filing & Retrieval Trends</h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--izou-muted)' }}>Monthly filing and retrieval activity over the past 7 months, from the archive audit log</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--izou-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--izou-muted)' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--izou-border)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="filings" stroke="var(--izou-secondary)" strokeWidth={2} dot={{ r: 3 }} name="Filings" />
                    <Line type="monotone" dataKey="retrievals" stroke="var(--izou-success)" strokeWidth={2} dot={{ r: 3 }} name="Retrievals" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Occupancy distribution */}
              <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--izou-border)', backgroundColor: '#fff' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Info size={16} style={{ color: 'var(--izou-muted)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>Slot Occupancy Distribution</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Empty', range: '0–24%', count: slots.filter((l) => getOccupancyPct(l) < 25).length, fill: 'var(--izou-border)' },
                    { label: 'Low', range: '25–49%', count: slots.filter((l) => getOccupancyPct(l) >= 25 && getOccupancyPct(l) < 50).length, fill: 'var(--izou-success)' },
                    { label: 'Moderate', range: '50–74%', count: slots.filter((l) => getOccupancyPct(l) >= 50 && getOccupancyPct(l) < 75).length, fill: '#EAB308' },
                    { label: 'High', range: '75–89%', count: slots.filter((l) => getOccupancyPct(l) >= 75 && getOccupancyPct(l) < 90).length, fill: 'var(--izou-warning)' },
                    { label: 'Critical', range: '90–100%', count: slots.filter((l) => getOccupancyPct(l) >= 90).length, fill: 'var(--izou-danger)' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: item.fill + '18', border: `1px solid ${item.fill}44` }}>
                      <div className="text-2xl font-bold" style={{ color: item.fill === 'var(--izou-border)' ? 'var(--izou-muted)' : item.fill }}>{item.count}</div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--izou-text)' }}>{item.label}</div>
                      <div className="text-xs" style={{ color: 'var(--izou-muted)' }}>{item.range}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── BOTTLENECKS TAB ── */}
          {activeTab === 'bottlenecks' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--izou-warning-light)', border: '1px solid var(--izou-warning-light)' }}>
                <Zap size={15} style={{ color: 'var(--izou-warning)' }} />
                <p className="text-xs" style={{ color: 'var(--izou-warning)' }}>
                  Bottlenecks are locations with ≥ 50% occupancy that may slow filing operations. Prioritize redistribution for critical items.
                </p>
              </div>

              {bottlenecks.length === 0 ? (
                <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: 'var(--izou-success-light)', border: '1px solid var(--izou-success-light)' }}>
                  <Activity size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-success)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--izou-success)' }}>No bottlenecks detected</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>All locations are below 50% capacity</p>
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--izou-border)' }}>
                  <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--izou-bg)', color: 'var(--izou-muted)', borderBottom: '1px solid var(--izou-border)' }}>
                    <div className="col-span-1">#</div>
                    <div className="col-span-1">Type</div>
                    <div className="col-span-3">Location</div>
                    <div className="col-span-3">Path</div>
                    <div className="col-span-2">Occupancy</div>
                    <div className="col-span-2">Fill Level</div>
                  </div>
                  <div className="divide-y divide-[var(--izou-border)]">
                    {bottlenecks.map((item, idx) => {
                      const colors = getHeatColor(item.pct);
                      return (
                        <div key={item.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                          <div className="col-span-1 text-xs font-bold" style={{ color: 'var(--izou-muted)' }}>{idx + 1}</div>
                          <div className="col-span-1 text-gray-500" title={item.type}>
                            {LEVEL_ICONS[item.type]}
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs font-semibold truncate" style={{ color: 'var(--izou-secondary)' }}>{item.name}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--izou-muted)' }}>{item.code}</p>
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs truncate" style={{ color: 'var(--izou-muted)' }}>{item.parentPath}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs font-semibold" style={{ color: colors.text }}>{item.occupancy}/{item.capacity}</p>
                            <div className="mt-0.5">
                              <StatusBadge label={colors.label} bg={colors.bg} text={colors.text} border={colors.border} />
                            </div>
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
