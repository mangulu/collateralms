'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEscalationRealtime } from '@/lib/hooks/useEscalationRealtime';
import { useDashboardRefresh } from '../DashboardRefreshContext';
import Link from 'next/link';

export default function DashboardHeader() {
  const { triggerRefresh } = useDashboardRefresh();
  const [lastUpdated, setLastUpdated] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [escalationBadge, setEscalationBadge] = useState(0);

  useEffect(() => {
    setLastUpdated(new Date()?.toLocaleString('en-TZ', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }, []);

  // ─── Live escalation subscription ──────────────────────────────────────────
  useEscalationRealtime({
    onEscalation: (event) => {
      const label = event.referenceLabel ?? event.referenceType ?? 'Workflow';
      const workflowInfo = event.workflowName ? ` (${event.workflowName})` : '';
      toast.warning(
        `⚠️ Escalation triggered: ${label}${workflowInfo}`,
        {
          description: event.performedByName
            ? `Escalated by ${event.performedByName}${event.comment ? ` — "${event.comment}"` : ''}`
            : event.comment ?? 'A workflow step has been escalated',
          duration: 8000,
          action: {
            label: 'View Instances',
            onClick: () => { window.location.href = '/workflows/instances'; },
          },
        }
      );
      setEscalationBadge((c) => c + 1);
    },
    onEscalatedCountChange: (count) => {
      // Only set badge if there are escalated instances and we haven't already counted new ones
      if (count > 0) setEscalationBadge((prev) => Math.max(prev, 0));
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    triggerRefresh();
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
    setLastUpdated(new Date()?.toLocaleString('en-TZ', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
    toast?.success('Dashboard refreshed');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateTo = new Date();
      const dateFrom = new Date(dateTo.getFullYear(), dateTo.getMonth() - 5, 1);
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'perfection_rate',
          dateFrom: dateFrom.toISOString().slice(0, 10),
          dateTo: dateTo.toISOString().slice(0, 10),
          registries: [],
          statuses: [],
          collateralTypes: [],
          includeCharts: false,
          includeSummary: true,
          includeDetails: false,
          stakeholderMode: false,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collateral_dashboard_${dateTo.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dashboard exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export dashboard');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--izou-text)' }}>Collateral Dashboard</h1>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full shrink-0"
            style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
          >
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
          {escalationBadge > 0 && (
            <Link
              href="/workflows/instances"
              onClick={() => setEscalationBadge(0)}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full shrink-0 transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
            >
              <AlertTriangle size={11} className="animate-pulse" />
              {escalationBadge} new escalation{escalationBadge > 1 ? 's' : ''}
            </Link>
          )}
        </div>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--izou-muted)' }}>
          Portfolio health overview · EXIM Bank Tanzania
          {lastUpdated && (
            <span className="ml-2 text-xs hidden sm:inline">· Last updated: {lastUpdated}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-60"
          style={{
            backgroundColor: 'var(--izou-card)',
            border: '1px solid var(--izou-border)',
            color: 'var(--izou-muted)',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-card)'; }}
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden xs:inline">Refresh</span>
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="izou-btn-primary flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold disabled:opacity-60"
        >
          <Download size={13} className={exporting ? 'animate-pulse' : ''} />
          <span>{exporting ? 'Exporting…' : 'Export'}</span>
        </button>
      </div>
    </div>
  );
}