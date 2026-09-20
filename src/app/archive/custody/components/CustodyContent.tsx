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
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';

// ─── Custody Tracker types ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CustodyStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  in_vault:  { label: 'In Vault',  bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)', icon: CheckCircle2 },
  on_loan:   { label: 'On Loan',   bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)', icon: ArrowDownToLine },
  overdue:   { label: 'Overdue',   bg: 'var(--izou-danger-light)', text: 'var(--izou-danger)', border: 'var(--izou-danger-light)', icon: AlertTriangle },
  returned:  { label: 'Returned',  bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary-mid)', border: 'var(--izou-secondary-light)', icon: RotateCcw },
  missing:   { label: 'Missing',   bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)', icon: AlertCircle },
};

async function sendOverdueSmsReminder(custody: ArchiveCustody, userId: string): Promise<void> {
  const phone = custody.checkedOutByProfile?.phone;
  if (!phone) {
    throw new Error(`No phone number on file for ${custody.checkedOutByProfile?.full_name ?? 'the officer who checked this out'}.`);
  }
  const message = `[CollateralMS] OVERDUE NOTICE: Physical file for collateral "${custody.collateral?.collateral_type ?? ''} — ${custody.collateral?.obligor ?? ''}" is overdue for return. Please return immediately. Ref: ${custody.collateralId.slice(0, 8).toUpperCase()}`;
  await fetch('/api/sms/send-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phone,
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
  custody_received:  { label: 'Received',        bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)', icon: CheckCircle2 },
  custody_handoff:   { label: 'Handoff',          bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)', icon: ArrowRight },
  officer_assigned:  { label: 'Officer Assigned', bg: 'var(--izou-highlight-light)', text: 'var(--izou-highlight)', border: 'var(--izou-highlight-light)', icon: User },
  collateral_moved:  { label: 'Moved',            bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)', icon: MapPin },
  checked_out:       { label: 'Checked Out',      bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)', icon: ArrowRight },
  returned:          { label: 'Returned',         bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary-mid)', border: 'var(--izou-secondary-light)', icon: RotateCcw },
};

const CONFIRM_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)' },
  confirmed: { label: 'Confirmed', bg: 'var(--izou-success-light)', text: 'var(--izou-success)' },
  rejected:  { label: 'Rejected',  bg: 'var(--izou-danger-light)', text: 'var(--izou-danger)' },
};

function getEventCfg(eventType: string) {
  return EVENT_CONFIG[eventType] ?? { label: eventType.replace(/_/g, ' '), bg: 'var(--izou-bg)', text: 'var(--izou-muted)', border: 'var(--izou-border)', icon: Clock };
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
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--izou-border)' }}>
      <div className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: 'var(--izou-secondary-light)', borderBottom: '1px solid var(--izou-border)' }}>
        <div className="flex items-center gap-2">
          <Package size={15} style={{ color: 'var(--izou-secondary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>{collateralLabel}</p>
          <StatusBadge label={`${entries.length} event${entries.length !== 1 ? 's' : ''}`} bg="var(--izou-secondary-light)" text="var(--izou-secondary)" />
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-blue-100 transition-colors"
          style={{ color: 'var(--izou-muted)' }}>
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
                  <div className="w-px flex-1 mt-1" style={{ backgroundColor: 'var(--izou-border)', minHeight: '16px' }} />
                )}
              </div>

              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge label={cfg.label} bg={cfg.bg} text={cfg.text} />
                    <StatusBadge label={confirmCfg.label} bg={confirmCfg.bg} text={confirmCfg.text} />
                  </div>
                  <span className="text-xs shrink-0" style={{ color: 'var(--izou-muted)' }}>
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {entry.fromOfficer && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                      <User size={11} />
                      <span className="font-medium">{entry.fromOfficer.full_name}</span>
                      <ArrowRight size={10} style={{ color: 'var(--izou-muted)' }} />
                    </div>
                  )}
                  {entry.toOfficer && (
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-secondary)' }}>
                      <Shield size={11} />
                      <span className="font-semibold">{entry.toOfficer.full_name}</span>
                    </div>
                  )}
                </div>

                {(entry.fromLocation || entry.toLocation) && (
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                    <MapPin size={11} />
                    {entry.fromLocation && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-warning-light)', color: 'var(--izou-warning)' }}>
                        {entry.fromLocation.code}
                      </span>
                    )}
                    {entry.fromLocation && entry.toLocation && <ArrowRight size={10} style={{ color: 'var(--izou-muted)' }} />}
                    {entry.toLocation && (
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-success-light)', color: 'var(--izou-success)' }}>
                        {entry.toLocation.code}
                      </span>
                    )}
                  </div>
                )}

                {entry.notes && (
                  <p className="text-xs mt-1 italic" style={{ color: 'var(--izou-muted)' }}>{entry.notes}</p>
                )}

                {entry.confirmedByProfile && entry.confirmationStatus === 'confirmed' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--izou-success)' }}>
                    ✓ Confirmed by {entry.confirmedByProfile.full_name}
                    {entry.confirmedAt ? ` · ${formatDateTime(entry.confirmedAt)}` : ''}
                  </p>
                )}

                {canConfirm && (
                  <button
                    onClick={() => onConfirm(entry.id)}
                    disabled={confirmingId === entry.id}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: 'var(--izou-success)' }}>
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
            style={{ color: 'var(--izou-secondary)' }}>
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
    } catch (e: unknown) {
      setCustodyError(e instanceof Error ? e.message : 'Failed to send SMS reminder');
    } finally { setSmsSending(null); }
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
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>Custody</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadCustody(); loadChain(); }} className="p-2 rounded-lg border" style={{ borderColor: 'var(--izou-border)' }}>
            <RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} />
          </button>
          {activeTab === 'history' && (
            <button onClick={exportChainCSV} disabled={filteredChain.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
              style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-secondary)' }}>
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--izou-bg)', width: 'fit-content' }}>
        {[
          { id: 'tracker' as ActiveTab, label: 'Current Status', count: custody.filter((c) => c.currentStatus === 'overdue').length },
          { id: 'history' as ActiveTab, label: 'History', count: pendingCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { backgroundColor: 'white', color: 'var(--izou-secondary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--izou-muted)' }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={activeTab === tab.id
                  ? { backgroundColor: tab.id === 'tracker' ? 'var(--izou-danger-light)' : 'var(--izou-secondary-light)', color: tab.id === 'tracker' ? 'var(--izou-danger)' : 'var(--izou-secondary)' }
                  : { backgroundColor: 'var(--izou-border)', color: 'var(--izou-muted)' }}>
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
                    backgroundColor: statusFilter === s ? sc.bg : 'var(--izou-bg)',
                    border: `1px solid ${statusFilter === s ? sc.border : 'var(--izou-border)'}`,
                  }}>
                  <StatusIcon size={16} style={{ color: sc.text }} className="mb-1" />
                  <p className="text-lg font-bold" style={{ color: sc.text }}>{custodyCounts[s] ?? 0}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--izou-muted)' }}>{sc.label}</p>
                </button>
              );
            })}
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
            <input value={custodySearch} onChange={(e) => setCustodySearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-bg)' }}
              placeholder="Search by collateral or owner…" />
          </div>

          {custodyError && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
              <AlertCircle size={16} /> {custodyError}
            </div>
          )}

          {custodyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />)}
            </div>
          ) : filteredCustody.length === 0 ? (
            <div className="text-center py-16">
              <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No custody records found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Assign placements to collaterals to track custody</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustody.map((c) => {
                const sc = STATUS_CONFIG[c.currentStatus];
                const StatusIcon = sc.icon;
                const isOverdue = c.currentStatus === 'overdue';
                return (
                  <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--izou-bg)', border: `1px solid ${isOverdue ? 'var(--izou-danger-light)' : 'var(--izou-border)'}` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
                      <StatusIcon size={18} style={{ color: sc.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>
                          {c.collateral?.collateral_type ?? 'Unknown'} — {c.collateral?.obligor ?? '—'}
                        </p>
                        <StatusBadge label={sc.label} bg={sc.bg} text={sc.text} border={sc.border} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {c.checkedOutByProfile && (
                          <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>
                            Checked out by: {c.checkedOutByProfile.full_name}
                          </span>
                        )}
                        {c.lastCheckedOutAt && (
                          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                            <Clock size={11} /> {new Date(c.lastCheckedOutAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {c.overdueSince && (
                          <span className="text-xs font-medium" style={{ color: 'var(--izou-danger)' }}>
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
                          backgroundColor: smsSuccess === c.id ? 'var(--izou-success-light)' : 'var(--izou-danger-light)',
                          color: smsSuccess === c.id ? 'var(--izou-success)' : 'var(--izou-danger)',
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
            <StatCard label="Total Events" value={entries.length} color="var(--izou-secondary)" bg="var(--izou-secondary-light)" border="var(--izou-secondary-light)" />
            <StatCard label="Pending Confirmation" value={pendingCount} color="var(--izou-warning)" bg="var(--izou-warning-light)" border="var(--izou-warning-light)" />
            <StatCard label="Confirmed" value={confirmedCount} color="var(--izou-success)" bg="var(--izou-success-light)" border="var(--izou-success-light)" />
            <StatCard label="Collaterals Tracked" value={Object.keys(grouped).length} color="var(--izou-highlight)" bg="var(--izou-highlight-light)" border="var(--izou-highlight-light)" />
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
              <input value={chainSearch} onChange={(e) => setChainSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-bg)' }}
                placeholder="Search by collateral, obligor, officer…" />
            </div>
            <div className="flex gap-2">
              {(['all', 'pending', 'confirmed'] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={filterStatus === s
                    ? { backgroundColor: 'var(--izou-secondary)', color: '#fff' }
                    : { backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' }}>
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
              {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16">
              <Link2 size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No custody chain records found</p>
              <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>
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
