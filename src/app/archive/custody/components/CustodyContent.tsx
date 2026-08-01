'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, AlertCircle, Clock, ArrowDownToLine,
  RotateCcw, AlertTriangle, CheckCircle2, Search, Send, Link2,
  Download, ArrowRight, User, MapPin, ChevronDown, ChevronUp,
  Shield, Package,
} from 'lucide-react';
import {
  archiveCustodyService, ArchiveCustody, CustodyStatus,
  archiveCustodyChainService, CustodyChainEntry,
} from '@/lib/supabase/archiveService';
import { archiveAuditService } from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Custody Tracker types ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CustodyStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  in_vault:  { label: 'In Vault',  bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2 },
  on_loan:   { label: 'On Loan',   bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowDownToLine },
  overdue:   { label: 'Overdue',   bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', icon: AlertTriangle },
  returned:  { label: 'Returned',  bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: RotateCcw },
  missing:   { label: 'Missing',   bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: AlertCircle },
};

async function sendOverdueSmsReminder(custody: ArchiveCustody, userId: string): Promise<void> {
  const message = `[CollateralMS] OVERDUE NOTICE: Physical file for collateral "${custody.collateral?.collateral_type ?? ''} — ${custody.collateral?.obligor ?? ''}" is overdue for return. Please return immediately. Ref: ${custody.collateralId.slice(0, 8).toUpperCase()}`;
  await fetch('/api/sms/send-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '+255700000000',
      message,
      alertType: 'OVERDUE_COLLATERAL',
      collateralId: custody.collateralId,
    }),
  });
  await archiveAuditService.log({
    eventType: 'sms_sent',
    collateralId: custody.collateralId,
    performedBy: userId,
    description: `Overdue SMS reminder sent for ${custody.collateral?.collateral_type ?? 'collateral'}`,
  });
}

// ─── Chain of Custody types ───────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  custody_received:  { label: 'Received',        bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2 },
  custody_handoff:   { label: 'Handoff',          bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowRight },
  officer_assigned:  { label: 'Officer Assigned', bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE', icon: User },
  collateral_moved:  { label: 'Moved',            bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', icon: MapPin },
  checked_out:       { label: 'Checked Out',      bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowRight },
  returned:          { label: 'Returned',         bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: RotateCcw },
};

const CONFIRM_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: '#FFFBEB', text: '#B45309' },
  confirmed: { label: 'Confirmed', bg: '#F0FDF4', text: '#15803D' },
  rejected:  { label: 'Rejected',  bg: '#FFF1F2', text: '#BE123C' },
};

function getEventCfg(eventType: string) {
  return EVENT_CONFIG[eventType] ?? { label: eventType.replace(/_/g, ' '), bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', icon: Clock };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Collateral Chain View ────────────────────────────────────────────────────

interface CollateralChainProps {
  collateralId: string;
  collateralLabel: string;
  entries: CustodyChainEntry[];
  onConfirm: (id: string) => void;
  confirmingId: string | null;
  userId: string;
  isApprover: boolean;
}

function CollateralChain({ collateralLabel, entries, onConfirm, confirmingId, userId, isApprover }: CollateralChainProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, 3);

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #DBEAFE' }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: '#EFF6FF', borderBottom: '1px solid #DBEAFE' }}>
        <div className="flex items-center gap-2">
          <Package size={15} style={{ color: '#1D4ED8' }} />
          <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>{collateralLabel}</p>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
            {entries.length} event{entries.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-blue-100 transition-colors"
          style={{ color: '#6B7280' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <div className="p-4 space-y-3" style={{ backgroundColor: 'white' }}>
        {visible.map((entry, idx) => {
          const cfg = getEventCfg(entry.eventType);
          const EntryIcon = cfg.icon;
          const confirmCfg = CONFIRM_CONFIG[entry.confirmationStatus];
          const canConfirm = isApprover && entry.confirmationStatus === 'pending' && entry.toOfficerId === userId;

          return (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2"
                  style={{ backgroundColor: cfg.bg, borderColor: cfg.text }}>
                  <EntryIcon size={13} style={{ color: cfg.text }} />
                </div>
                {idx < visible.length - 1 && (
                  <div className="w-px flex-1 mt-1" style={{ backgroundColor: '#DBEAFE', minHeight: '16px' }} />
                )}
              </div>

              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                      {cfg.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: confirmCfg.bg, color: confirmCfg.text }}>
                      {confirmCfg.label}
                    </span>
                  </div>
                  <span className="text-xs shrink-0" style={{ color: '#9CA3AF' }}>
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {entry.fromOfficer && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                      <User size={11} />
                      <span className="font-medium">{entry.fromOfficer.full_name}</span>
                      <ArrowRight size={10} style={{ color: '#9CA3AF' }} />
                    </div>
                  )}
                  {entry.toOfficer && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: '#1E3A8A' }}>
                      <Shield size={11} />
                      <span className="font-semibold">{entry.toOfficer.full_name}</span>
                    </div>
                  )}
                </div>

                {(entry.fromLocation || entry.toLocation) && (
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: '#6B7280' }}>
                    <MapPin size={11} />
                    {entry.fromLocation && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        {entry.fromLocation.code}
                      </span>
                    )}
                    {entry.fromLocation && entry.toLocation && <ArrowRight size={10} style={{ color: '#9CA3AF' }} />}
                    {entry.toLocation && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                        {entry.toLocation.code}
                      </span>
                    )}
                  </div>
                )}

                {entry.notes && (
                  <p className="text-xs mt-1 italic" style={{ color: '#9CA3AF' }}>{entry.notes}</p>
                )}

                {entry.confirmedByProfile && entry.confirmationStatus === 'confirmed' && (
                  <p className="text-xs mt-1" style={{ color: '#15803D' }}>
                    ✓ Confirmed by {entry.confirmedByProfile.full_name}
                    {entry.confirmedAt ? ` · ${formatDateTime(entry.confirmedAt)}` : ''}
                  </p>
                )}

                {canConfirm && (
                  <button
                    onClick={() => onConfirm(entry.id)}
                    disabled={confirmingId === entry.id}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#15803D' }}>
                    <CheckCircle2 size={12} />
                    {confirmingId === entry.id ? 'Confirming…' : 'Confirm Receipt'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {entries.length > 3 && (
          <button onClick={() => setExpanded(!expanded)}
            className="w-full text-xs font-medium py-1.5 rounded-lg transition-colors hover:bg-blue-50"
            style={{ color: '#2563EB' }}>
            {expanded ? 'Show less' : `Show ${entries.length - 3} more events`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveTab = 'tracker' | 'history';

export default function CustodyContent() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tracker');

  // Custody Tracker state
  const [custody, setCustody] = useState<ArchiveCustody[]>([]);
  const [custodyLoading, setCustodyLoading] = useState(true);
  const [custodyError, setCustodyError] = useState('');
  const [custodySearch, setCustodySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustodyStatus | 'all'>('all');
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);

  // Chain of Custody state
  const [entries, setEntries] = useState<CustodyChainEntry[]>([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState('');
  const [chainSearch, setChainSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const isApprover = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'credit_officer';

  const loadCustody = useCallback(async () => {
    setCustodyLoading(true);
    try {
      await archiveCustodyService.flagOverdue();
      const data = await archiveCustodyService.getAll();
      setCustody(data);
    } catch (e: unknown) {
      setCustodyError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setCustodyLoading(false); }
  }, []);

  const loadChain = useCallback(async () => {
    setChainLoading(true);
    setChainError('');
    try {
      const data = await archiveCustodyChainService.getAll(500);
      setEntries(data);
    } catch (e: unknown) {
      setChainError(e instanceof Error ? e.message : 'Failed to load custody chain');
    } finally { setChainLoading(false); }
  }, []);

  useEffect(() => { loadCustody(); }, [loadCustody]);
  useEffect(() => { loadChain(); }, [loadChain]);

  useEffect(() => {
    const channel = archiveCustodyChainService.subscribeToChanges(() => { loadChain(); });
    return () => { channel.unsubscribe(); };
  }, [loadChain]);

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    try {
      await archiveCustodyChainService.confirm(id, user?.id ?? '');
      await loadChain();
    } catch { /* silent */ }
    finally { setConfirmingId(null); }
  };

  const handleSendSms = async (c: ArchiveCustody) => {
    setSmsSending(c.id);
    try {
      await sendOverdueSmsReminder(c, user?.id ?? '');
      setSmsSuccess(c.id);
      setTimeout(() => setSmsSuccess(null), 3000);
    } catch { /* silent */ }
    finally { setSmsSending(null); }
  };

  // Custody tracker filtered
  const filteredCustody = custody.filter((c) => {
    const q = custodySearch.toLowerCase();
    const matchSearch = !q || c.collateral?.obligor?.toLowerCase().includes(q) || c.collateral?.description?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.currentStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const custodyCounts = custody.reduce((acc, c) => {
    acc[c.currentStatus] = (acc[c.currentStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Chain filtered + grouped
  const filteredChain = entries.filter((e) => {
    const q = chainSearch.toLowerCase();
    const matchSearch = !q
      || e.collateral?.obligor?.toLowerCase().includes(q)
      || e.collateral?.collateral_type?.toLowerCase().includes(q)
      || e.collateral?.description?.toLowerCase().includes(q)
      || e.fromOfficer?.full_name?.toLowerCase().includes(q)
      || e.toOfficer?.full_name?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || e.confirmationStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const grouped = filteredChain.reduce((acc, e) => {
    const key = e.collateralId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, CustodyChainEntry[]>);

  const pendingCount = entries.filter((e) => e.confirmationStatus === 'pending').length;
  const confirmedCount = entries.filter((e) => e.confirmationStatus === 'confirmed').length;

  const exportChainCSV = () => {
    const rows = [
      ['Timestamp', 'Collateral', 'Obligor', 'Event', 'From Officer', 'To Officer', 'From Location', 'To Location', 'Status', 'Confirmed By', 'Notes'],
      ...filteredChain.map((e) => [
        formatDateTime(e.createdAt),
        e.collateral?.collateral_type ?? '—',
        e.collateral?.obligor ?? '—',
        getEventCfg(e.eventType).label,
        e.fromOfficer?.full_name ?? '—',
        e.toOfficer?.full_name ?? '—',
        e.fromLocation?.code ?? '—',
        e.toLocation?.code ?? '—',
        CONFIRM_CONFIG[e.confirmationStatus].label,
        e.confirmedByProfile?.full_name ?? '—',
        e.notes ?? '—',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chain-of-custody-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Custody</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>
            Live custody status and full chain-of-custody history for all physical collateral files
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadCustody(); loadChain(); }} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
          {activeTab === 'history' && (
            <button onClick={exportChainCSV} disabled={filteredChain.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
              style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: '#F1F5F9', width: 'fit-content' }}>
        {[
          { id: 'tracker' as ActiveTab, label: 'Current Status', count: custody.filter((c) => c.currentStatus === 'overdue').length },
          { id: 'history' as ActiveTab, label: 'History', count: pendingCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { backgroundColor: 'white', color: '#1E3A8A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6B7280' }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={activeTab === tab.id
                  ? { backgroundColor: tab.id === 'tracker' ? '#FFF1F2' : '#DBEAFE', color: tab.id === 'tracker' ? '#BE123C' : '#1D4ED8' }
                  : { backgroundColor: '#E5E7EB', color: '#6B7280' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Current Status Tab ── */}
      {activeTab === 'tracker' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
            {(Object.keys(STATUS_CONFIG) as CustodyStatus[]).map((s) => {
              const sc = STATUS_CONFIG[s];
              const StatusIcon = sc.icon;
              return (
                <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    backgroundColor: statusFilter === s ? sc.bg : '#F8FAFF',
                    border: `1px solid ${statusFilter === s ? sc.border : '#DBEAFE'}`,
                  }}>
                  <StatusIcon size={16} style={{ color: sc.text }} className="mb-1" />
                  <p className="text-lg font-bold" style={{ color: sc.text }}>{custodyCounts[s] ?? 0}</p>
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{sc.label}</p>
                </button>
              );
            })}
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
            <input value={custodySearch} onChange={(e) => setCustodySearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
              placeholder="Search by collateral or owner…" />
          </div>

          {custodyError && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
              <AlertCircle size={16} /> {custodyError}
            </div>
          )}

          {custodyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
            </div>
          ) : filteredCustody.length === 0 ? (
            <div className="text-center py-16">
              <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
              <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No custody records found</p>
              <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>Assign placements to collaterals to track custody</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustody.map((c) => {
                const sc = STATUS_CONFIG[c.currentStatus];
                const StatusIcon = sc.icon;
                const isOverdue = c.currentStatus === 'overdue';
                return (
                  <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ backgroundColor: '#F8FAFF', border: `1px solid ${isOverdue ? '#FECDD3' : '#DBEAFE'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
                      <StatusIcon size={18} style={{ color: sc.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>
                          {c.collateral?.collateral_type ?? 'Unknown'} — {c.collateral?.obligor ?? '—'}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.checkedOutByProfile && (
                          <span className="text-xs" style={{ color: '#6B7280' }}>
                            Checked out by: {c.checkedOutByProfile.full_name}
                          </span>
                        )}
                        {c.lastCheckedOutAt && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                            <Clock size={11} /> {new Date(c.lastCheckedOutAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {c.overdueSince && (
                          <span className="text-xs font-medium" style={{ color: '#BE123C' }}>
                            Overdue since {new Date(c.overdueSince).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOverdue && (
                      <button
                        onClick={() => handleSendSms(c)}
                        disabled={smsSending === c.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: smsSuccess === c.id ? '#F0FDF4' : '#FFF1F2',
                          color: smsSuccess === c.id ? '#15803D' : '#BE123C',
                          opacity: smsSending === c.id ? 0.6 : 1,
                        }}>
                        {smsSuccess === c.id ? <CheckCircle2 size={12} /> : <Send size={12} />}
                        {smsSuccess === c.id ? 'Sent!' : smsSending === c.id ? 'Sending…' : 'SMS Reminder'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total Events', value: entries.length, color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
              { label: 'Pending Confirmation', value: pendingCount, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'Confirmed', value: confirmedCount, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
              { label: 'Collaterals Tracked', value: Object.keys(grouped).length, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4"
                style={{ backgroundColor: stat.bg, border: `1px solid ${stat.border}` }}>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: '#6B7280' }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input value={chainSearch} onChange={(e) => setChainSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
                placeholder="Search by collateral, obligor, officer…" />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'confirmed'] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={filterStatus === s
                    ? { backgroundColor: '#2563EB', color: '#fff' }
                    : { backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {chainError && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
              <AlertCircle size={16} /> {chainError}
            </div>
          )}

          {chainLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16">
              <Link2 size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
              <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No custody chain records found</p>
              <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
                Custody events are recorded when collaterals are filed, moved, or checked out
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([collateralId, collateralEntries]) => {
                const first = collateralEntries[0];
                const label = first.collateral
                  ? `${first.collateral.collateral_type} — ${first.collateral.description} (${first.collateral.obligor})`
                  : collateralId.slice(0, 8).toUpperCase();
                return (
                  <CollateralChain
                    key={collateralId}
                    collateralId={collateralId}
                    collateralLabel={label}
                    entries={collateralEntries}
                    onConfirm={handleConfirm}
                    confirmingId={confirmingId}
                    userId={user?.id ?? ''}
                    isApprover={isApprover}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
