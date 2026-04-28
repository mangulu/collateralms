'use client';
import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, XCircle, RefreshCw, Search, TrendingUp, Fingerprint, FileWarning, Clock, ChevronDown, Activity, Zap,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType = 'DUPLICATE_TITLE' | 'IDENTITY_MISMATCH' | 'VALUATION_ANOMALY' | 'EARLY_WARNING' | 'DOCUMENT_FORGERY';
type AlertStatus = 'PENDING_REVIEW' | 'FALSE_POSITIVE' | 'ESCALATED' | 'RESOLVED';
type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

interface FraudAlert {
  id: string;
  collateralId: string;
  alertType: AlertType;
  riskScore: number;
  confidence: number;
  severity: Severity;
  description: string;
  details: {
    field?: string;
    value?: string;
    expected?: string;
    found?: string;
    duplicateWith?: string;
    deviation?: string;
  };
  status: AlertStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockAlerts: FraudAlert[] = [
  {
    id: 'FA-001',
    collateralId: 'COL-2024-0891',
    alertType: 'DUPLICATE_TITLE',
    riskScore: 94.5,
    confidence: 95.2,
    severity: 'HIGH',
    description: 'Title deed TD-00123 already registered under Customer A (LN-001234)',
    details: { field: 'title_deed_number', value: 'TD-00123', duplicateWith: 'LN-001234' },
    status: 'PENDING_REVIEW',
    createdAt: '2024-06-15T08:30:00Z',
  },
  {
    id: 'FA-002',
    collateralId: 'COL-2024-0756',
    alertType: 'VALUATION_ANOMALY',
    riskScore: 78.3,
    confidence: 82.1,
    severity: 'HIGH',
    description: 'Submitted valuation is 47% above market average for this property type and region',
    details: { field: 'valuation_amount', value: '850,000,000 TZS', expected: '578,000,000 TZS', deviation: '+47%' },
    status: 'PENDING_REVIEW',
    createdAt: '2024-06-14T14:22:00Z',
  },
  {
    id: 'FA-003',
    collateralId: 'COL-2024-0612',
    alertType: 'IDENTITY_MISMATCH',
    riskScore: 65.0,
    confidence: 71.4,
    severity: 'MEDIUM',
    description: 'Customer name on title deed does not match national ID document',
    details: { field: 'customer_name', found: 'John M. Doe', expected: 'Jonathan Doe' },
    status: 'ESCALATED',
    reviewedBy: 'Risk Officer A',
    reviewedAt: '2024-06-14T16:00:00Z',
    createdAt: '2024-06-13T09:15:00Z',
  },
  {
    id: 'FA-004',
    collateralId: 'COL-2024-0534',
    alertType: 'DOCUMENT_FORGERY',
    riskScore: 88.7,
    confidence: 79.6,
    severity: 'HIGH',
    description: 'AI analysis detected potential tampering in uploaded title deed scan — metadata inconsistency',
    details: { field: 'document_metadata', found: 'Modified: 2024-06-10', expected: 'Original issue date: 2019-03-15' },
    status: 'PENDING_REVIEW',
    createdAt: '2024-06-13T11:45:00Z',
  },
  {
    id: 'FA-005',
    collateralId: 'COL-2024-0489',
    alertType: 'EARLY_WARNING',
    riskScore: 42.1,
    confidence: 68.3,
    severity: 'MEDIUM',
    description: 'Borrower risk indicators changed: 2 new adverse media mentions detected in last 30 days',
    details: { field: 'adverse_media', value: '2 new mentions', expected: '0 mentions' },
    status: 'PENDING_REVIEW',
    createdAt: '2024-06-12T07:00:00Z',
  },
  {
    id: 'FA-006',
    collateralId: 'COL-2024-0321',
    alertType: 'IDENTITY_MISMATCH',
    riskScore: 31.5,
    confidence: 55.0,
    severity: 'LOW',
    description: 'Minor discrepancy in address between ID document and collateral registration form',
    details: { field: 'address', found: 'Plot 45, Kinondoni', expected: 'Plot 45A, Kinondoni' },
    status: 'FALSE_POSITIVE',
    reviewedBy: 'Risk Officer B',
    reviewedAt: '2024-06-11T13:30:00Z',
    createdAt: '2024-06-10T10:00:00Z',
  },
  {
    id: 'FA-007',
    collateralId: 'COL-2024-0290',
    alertType: 'DUPLICATE_TITLE',
    riskScore: 91.2,
    confidence: 93.8,
    severity: 'HIGH',
    description: 'Title deed TD-00456 appears in two active loan applications simultaneously',
    details: { field: 'title_deed_number', value: 'TD-00456', duplicateWith: 'LN-002891' },
    status: 'RESOLVED',
    reviewedBy: 'Risk Manager',
    reviewedAt: '2024-06-09T15:00:00Z',
    createdAt: '2024-06-08T09:00:00Z',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const alertTypeConfig: Record<AlertType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DUPLICATE_TITLE: { label: 'Duplicate Title', icon: FileWarning, color: 'text-red-600', bg: 'bg-red-100' },
  IDENTITY_MISMATCH: { label: 'Identity Mismatch', icon: Fingerprint, color: 'text-orange-600', bg: 'bg-orange-100' },
  VALUATION_ANOMALY: { label: 'Valuation Anomaly', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100' },
  EARLY_WARNING: { label: 'Early Warning', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' },
  DOCUMENT_FORGERY: { label: 'Document Forgery', icon: ShieldAlert, color: 'text-purple-600', bg: 'bg-purple-100' },
};

const statusConfig: Record<AlertStatus, { label: string; color: string }> = {
  PENDING_REVIEW: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  FALSE_POSITIVE: { label: 'False Positive', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  ESCALATED: { label: 'Escalated', color: 'bg-red-100 text-red-700 border-red-200' },
  RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-700 border-green-200' },
};

const severityConfig: Record<Severity, { color: string; dot: string }> = {
  HIGH: { color: 'text-red-600', dot: 'bg-red-500' },
  MEDIUM: { color: 'text-amber-600', dot: 'bg-amber-500' },
  LOW: { color: 'text-blue-600', dot: 'bg-blue-400' },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function RiskScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-amber-500' : 'bg-blue-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-700 tabular-nums w-10 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, variant = 'default' }: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; variant?: 'default' | 'danger' | 'warning' | 'success';
}) {
  const bg = { default: 'bg-white border-border', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200', success: 'bg-green-50 border-green-200' };
  const iconBg = { default: 'bg-primary/10 text-primary', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600', success: 'bg-green-100 text-green-600' };
  const valColor = { default: 'text-foreground', danger: 'text-red-700', warning: 'text-amber-700', success: 'text-green-700' };
  return (
    <div className={`rounded-xl p-5 shadow-card border ${bg[variant]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-700 tabular-nums mb-1 font-mono ${valColor[variant]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Alert Row ────────────────────────────────────────────────────────────────

function AlertRow({ alert, onAction }: { alert: FraudAlert; onAction: (id: string, action: 'FALSE_POSITIVE' | 'ESCALATED') => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeConf = alertTypeConfig[alert.alertType];
  const statusConf = statusConfig[alert.status];
  const sevConf = severityConfig[alert.severity];
  const TypeIcon = typeConf.icon;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white shadow-card mb-3">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeConf.bg}`}>
          <TypeIcon size={16} className={typeConf.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-600 text-foreground">{alert.id}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground font-500">{alert.collateralId}</span>
            <span className={`inline-flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full border ${statusConf.color}`}>
              {statusConf.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.description}</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="w-28">
            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
            <RiskScoreBar score={alert.riskScore} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${sevConf.dot}`} />
            <span className={`text-xs font-600 ${sevConf.color}`}>{alert.severity}</span>
          </div>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Alert Type</p>
              <p className="text-sm font-500 text-foreground">{typeConf.label}</p>
            </div>
            <div>
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Confidence</p>
              <p className="text-sm font-500 text-foreground">{alert.confidence.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Detected At</p>
              <p className="text-sm font-500 text-foreground">{formatDateTime(alert.createdAt)}</p>
            </div>
            {Object.entries(alert.details).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">{k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-500 text-foreground">{v}</p>
              </div>
            ))}
            {alert.reviewedBy && (
              <div>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Reviewed By</p>
                <p className="text-sm font-500 text-foreground">{alert.reviewedBy} · {alert.reviewedAt ? formatDateTime(alert.reviewedAt) : ''}</p>
              </div>
            )}
          </div>
          {alert.status === 'PENDING_REVIEW' && (
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                onClick={() => onAction(alert.id, 'FALSE_POSITIVE')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <XCircle size={13} /> Mark False Positive
              </button>
              <button
                onClick={() => onAction(alert.id, 'ESCALATED')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <AlertTriangle size={13} /> Escalate for Investigation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FraudPreventionContent() {
  const [alerts, setAlerts] = useState<FraudAlert[]>(mockAlerts);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    setLastRefreshed(new Date().toLocaleTimeString('en-GB'));
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString('en-GB'));
    }, 1000);
  };

  const handleAction = (id: string, action: 'FALSE_POSITIVE' | 'ESCALATED') => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: action, reviewedBy: 'Current User', reviewedAt: new Date().toISOString() } : a));
  };

  const filtered = alerts.filter((a) => {
    const matchSearch = !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.collateralId.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || a.alertType === typeFilter;
    const matchStatus = statusFilter === 'All' || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const pending = alerts.filter((a) => a.status === 'PENDING_REVIEW').length;
  const escalated = alerts.filter((a) => a.status === 'ESCALATED').length;
  const highRisk = alerts.filter((a) => a.severity === 'HIGH').length;
  const avgScore = alerts.length > 0 ? (alerts.reduce((s, a) => s + a.riskScore, 0) / alerts.length).toFixed(1) : '0.0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <ShieldAlert size={18} className="text-red-600" />
            </div>
            <h1 className="text-xl font-700 text-foreground">AI & Fraud Prevention</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            AI-powered anomaly detection, identity risk scoring, and document forgery analysis
            {lastRefreshed && <span className="ml-2 text-xs">· Last refreshed {lastRefreshed}</span>}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Pending Review" value={pending} sub="Alerts awaiting analyst action" icon={Clock} variant="warning" />
        <SummaryCard label="Escalated" value={escalated} sub="Under active investigation" icon={AlertTriangle} variant="danger" />
        <SummaryCard label="High Risk Alerts" value={highRisk} sub="Severity: HIGH" icon={ShieldAlert} variant="danger" />
        <SummaryCard label="Avg Risk Score" value={avgScore} sub="Across all active alerts" icon={Zap} variant="default" />
      </div>

      {/* Detection Capabilities */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-card">
        <h2 className="text-sm font-700 text-foreground mb-4">Detection Capabilities</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { type: 'DUPLICATE_TITLE' as AlertType, priority: 'P1', desc: 'Identify duplicate title deeds across different customers' },
            { type: 'IDENTITY_MISMATCH' as AlertType, priority: 'P1', desc: 'Cross-reference identities with watchlists and blacklists' },
            { type: 'VALUATION_ANOMALY' as AlertType, priority: 'P1', desc: 'Flag valuations >30% above market average' },
            { type: 'DOCUMENT_FORGERY' as AlertType, priority: 'P2', desc: 'AI-based document tampering and signature analysis' },
          ].map(({ type, priority, desc }) => {
            const conf = alertTypeConfig[type];
            const TypeIcon = conf.icon;
            return (
              <div key={type} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${conf.bg}`}>
                  <TypeIcon size={15} className={conf.color} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-700 text-foreground">{conf.label}</p>
                    <span className={`text-[10px] font-700 px-1.5 py-0.5 rounded ${priority === 'P1' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{priority}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search alerts, collateral ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="All">All Types</option>
          {Object.entries(alertTypeConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="All">All Statuses</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Alert List */}
      <div>
        <h2 className="text-sm font-700 text-foreground mb-3">Fraud Alerts</h2>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldAlert size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No alerts match your filters</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <AlertRow key={alert.id} alert={alert} onAction={handleAction} />
          ))
        )}
      </div>
    </div>
  );
}
