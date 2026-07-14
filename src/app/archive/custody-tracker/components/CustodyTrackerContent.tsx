'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, RefreshCw, AlertCircle, Clock, ArrowDownToLine,
  RotateCcw, AlertTriangle, CheckCircle2, Search, Send,
} from 'lucide-react';
import { archiveCustodyService, ArchiveCustody, CustodyStatus } from '@/lib/supabase/archiveService';
import { archiveAuditService } from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


const STATUS_CONFIG: Record<CustodyStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  in_vault:  { label: 'In Vault',  bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2 },
  on_loan:   { label: 'On Loan',   bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowDownToLine },
  overdue:   { label: 'Overdue',   bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', icon: AlertTriangle },
  returned:  { label: 'Returned',  bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: RotateCcw },
  missing:   { label: 'Missing',   bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: AlertCircle },
};

async function sendOverdueSmsReminder(custody: ArchiveCustody, userId: string): Promise<void> {
  const message = `[CollateralMS] OVERDUE NOTICE: Physical file for collateral "${custody.collateral?.collateral_type ?? ''} — ${custody.collateral?.owner_name ?? ''}" is overdue for return. Please return immediately. Ref: ${custody.collateralId.slice(0, 8).toUpperCase()}`;
  await fetch('/api/sms/send-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '+255700000000', // placeholder — real number from officer profile
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

export default function CustodyTrackerContent() {
  const { user } = useAuth();
  const [custody, setCustody] = useState<ArchiveCustody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustodyStatus | 'all'>('all');
  const [smsSending, setSmsSending] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await archiveCustodyService.flagOverdue();
      const data = await archiveCustodyService.getAll();
      setCustody(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = custody.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.collateral?.owner_name?.toLowerCase().includes(q) || c.collateral?.description?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.currentStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = custody.reduce((acc, c) => {
    acc[c.currentStatus] = (acc[c.currentStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSendSms = async (c: ArchiveCustody) => {
    setSmsSending(c.id);
    try {
      await sendOverdueSmsReminder(c, user?.id ?? '');
      setSmsSuccess(c.id);
      setTimeout(() => setSmsSuccess(null), 3000);
    } catch { /* silent */ }
    finally { setSmsSending(null); }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Custody Tracker</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>Live custody status for every physical collateral file</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
          <RefreshCw size={16} style={{ color: '#2563EB' }} />
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {(Object.keys(STATUS_CONFIG) as CustodyStatus[]).map((s) => {
          const sc = STATUS_CONFIG[s];
          const Icon = sc.icon;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                backgroundColor: statusFilter === s ? sc.bg : '#F8FAFF',
                border: `1px solid ${statusFilter === s ? sc.border : '#DBEAFE'}`,
              }}>
              <Icon size={16} style={{ color: sc.text }} className="mb-1" />
              <p className="text-lg font-bold" style={{ color: sc.text }}>{counts[s] ?? 0}</p>
              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
          placeholder="Search by collateral or owner…" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No custody records found</p>
          <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>Assign placements to collaterals to track custody</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const sc = STATUS_CONFIG[c.currentStatus];
            const Icon = sc.icon;
            const isOverdue = c.currentStatus === 'overdue';
            return (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl"
                style={{ backgroundColor: '#F8FAFF', border: `1px solid ${isOverdue ? '#FECDD3' : '#DBEAFE'}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
                  <Icon size={18} style={{ color: sc.text }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>
                      {c.collateral?.collateral_type ?? 'Unknown'} — {c.collateral?.owner_name ?? '—'}
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
    </div>
  );
}
