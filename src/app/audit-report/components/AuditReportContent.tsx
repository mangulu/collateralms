'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Download, RefreshCw, ShieldAlert, Scale, Map, AlertTriangle, Building2, Calendar, Loader2, Filter, TrendingUp, Fingerprint, FileWarning, MapPin, Activity,  } from 'lucide-react';

import { fetchFraudAlerts, type FraudAlertRow } from '@/lib/supabase/fraudAlertService';
import { collateralService, type CollateralRecord } from '@/lib/supabase/collateralService';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportSummary {
  totalFraudAlerts: number;
  highRiskAlerts: number;
  pendingReview: number;
  ruleViolations: number;
  activeViolations: number;
  geoCollateral: number;
  unverifiedLocations: number;
  reportDate: string;
}

interface RuleViolation {
  id: string;
  ruleName: string;
  ruleType: string;
  action: string;
  collateralId: string;
  obligor: string;
  triggeredAt: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

interface GeoCollateralRecord {
  id: string;
  collateralId: string;
  obligor: string;
  type: string;
  address: string;
  status: string;
  riskZone: string;
  coordinates: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'MISMATCH';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const alertTypeLabel: Record<string, string> = {
  DUPLICATE_TITLE: 'Duplicate Title',
  IDENTITY_MISMATCH: 'Identity Mismatch',
  VALUATION_ANOMALY: 'Valuation Anomaly',
  EARLY_WARNING: 'Early Warning',
  DOCUMENT_FORGERY: 'Document Forgery',
};

const alertTypeIcon: Record<string, React.ElementType> = {
  DUPLICATE_TITLE: FileWarning,
  IDENTITY_MISMATCH: Fingerprint,
  VALUATION_ANOMALY: TrendingUp,
  EARLY_WARNING: AlertTriangle,
  DOCUMENT_FORGERY: FileText,
};

const severityBadge: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border border-red-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border border-amber-200',
  LOW: 'bg-blue-100 text-blue-700 border border-blue-200',
};

const statusBadge: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-700 border border-amber-200',
  FALSE_POSITIVE: 'bg-gray-100 text-gray-600 border border-gray-200',
  ESCALATED: 'bg-red-100 text-red-700 border border-red-200',
  RESOLVED: 'bg-green-100 text-green-700 border border-green-200',
};

const verificationBadge: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700 border border-green-200',
  UNVERIFIED: 'bg-amber-100 text-amber-700 border border-amber-200',
  MISMATCH: 'bg-red-100 text-red-700 border border-red-200',
};

const riskZoneBadge: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-600',
  MEDIUM: 'bg-amber-50 text-amber-600',
  LOW: 'bg-green-50 text-green-600',
};

// Mock rule violations derived from compliance rules
const mockRuleViolations: RuleViolation[] = [
  {
    id: 'VIO-001', ruleName: 'LTV Supervisor Approval', ruleType: 'LTV', action: 'BLOCK',
    collateralId: 'COL-2024-0891', obligor: 'Karibu Enterprises Ltd',
    triggeredAt: '2024-06-15T09:30:00Z', severity: 'HIGH',
    message: 'LTV exceeds 70% limit. Supervisor approval required before proceeding.',
  },
  {
    id: 'VIO-002', ruleName: 'BRELA 42-Day Deadline Warning', ruleType: 'DEADLINE', action: 'WARN',
    collateralId: 'COL-2024-0756', obligor: 'Sunrise Trading Co.',
    triggeredAt: '2024-06-14T11:00:00Z', severity: 'MEDIUM',
    message: 'BRELA submission deadline is within 7 days. Immediate action required.',
  },
  {
    id: 'VIO-003', ruleName: 'Overdue BRELA Filing Block', ruleType: 'DEADLINE', action: 'BLOCK',
    collateralId: 'COL-2024-0612', obligor: 'Mwanga Holdings',
    triggeredAt: '2024-06-13T08:15:00Z', severity: 'HIGH',
    message: 'BRELA filing deadline has passed. Escalate to compliance team immediately.',
  },
  {
    id: 'VIO-004', ruleName: 'High LTV Audit Log', ruleType: 'LTV', action: 'LOG',
    collateralId: 'COL-2024-0543', obligor: 'Bahari Investments',
    triggeredAt: '2024-06-12T14:45:00Z', severity: 'LOW',
    message: 'LTV above 60% — logged for audit trail review.',
  },
  {
    id: 'VIO-005', ruleName: 'Ineligible Collateral Type Block', ruleType: 'ELIGIBILITY', action: 'BLOCK',
    collateralId: 'COL-2024-0489', obligor: 'Kilimanjaro Traders',
    triggeredAt: '2024-06-11T10:20:00Z', severity: 'HIGH',
    message: 'Collateral type not eligible under current lending policy.',
  },
  {
    id: 'VIO-006', ruleName: 'Missing Insurance Warning', ruleType: 'ELIGIBILITY', action: 'WARN',
    collateralId: 'COL-2024-0401', obligor: 'Serengeti Logistics',
    triggeredAt: '2024-06-10T16:00:00Z', severity: 'MEDIUM',
    message: 'Insurance documentation missing or expired.',
  },
];

// Mock geo collateral data
const mockGeoCollateral: GeoCollateralRecord[] = [
  {
    id: 'GEO-001', collateralId: 'COL-2024-0891', obligor: 'Karibu Enterprises Ltd',
    type: 'Land Title', address: 'Plot 45, Msasani Peninsula, Dar es Salaam',
    status: 'Perfected', riskZone: 'LOW', coordinates: '-6.7924, 39.2083', verificationStatus: 'VERIFIED',
  },
  {
    id: 'GEO-002', collateralId: 'COL-2024-0756', obligor: 'Sunrise Trading Co.',
    type: 'Commercial Property', address: 'Kariakoo Market Area, Dar es Salaam',
    status: 'Under Review', riskZone: 'MEDIUM', coordinates: '-6.8235, 39.2695', verificationStatus: 'UNVERIFIED',
  },
  {
    id: 'GEO-003', collateralId: 'COL-2024-0612', obligor: 'Mwanga Holdings',
    type: 'Residential Property', address: 'Kinondoni District, Dar es Salaam',
    status: 'Overdue', riskZone: 'HIGH', coordinates: '-6.7780, 39.2494', verificationStatus: 'MISMATCH',
  },
  {
    id: 'GEO-004', collateralId: 'COL-2024-0543', obligor: 'Bahari Investments',
    type: 'Land Title', address: 'Mikocheni B, Dar es Salaam',
    status: 'Perfected', riskZone: 'LOW', coordinates: '-6.7600, 39.2300', verificationStatus: 'VERIFIED',
  },
  {
    id: 'GEO-005', collateralId: 'COL-2024-0489', obligor: 'Kilimanjaro Traders',
    type: 'Warehouse', address: 'Ubungo Industrial Area, Dar es Salaam',
    status: 'Submitted', riskZone: 'MEDIUM', coordinates: '-6.7900, 39.2100', verificationStatus: 'UNVERIFIED',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, variant = 'default',
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; variant?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const bg = { default: 'bg-white border-border', success: 'bg-green-50 border-green-200', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200' };
  const iconBg = { default: 'bg-primary/10 text-primary', success: 'bg-green-100 text-green-600', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600' };
  const valColor = { default: 'text-foreground', success: 'text-green-700', danger: 'text-red-700', warning: 'text-amber-700' };
  return (
    <div className={`rounded-xl p-5 shadow-card border ${bg[variant]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-bold tabular-nums mb-1 font-mono ${valColor[variant]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function SectionHeader({ title, sub, icon: Icon }: { title: string; sub: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-primary" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditReportContent() {
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlertRow[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'fraud' | 'violations' | 'geomapping'>('fraud');
  const [fraudFilter, setFraudFilter] = useState('All');
  const [violationFilter, setViolationFilter] = useState('All');
  const [reportDateFrom, setReportDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [reportDateTo, setReportDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alerts, collateralData] = await Promise.all([
        fetchFraudAlerts(),
        collateralService.getAll(),
      ]);

      setFraudAlerts(alerts);
      setCollaterals(collateralData);

      const highRisk = alerts.filter((a) => a.risk_score >= 80).length;
      const pending = alerts.filter((a) => a.status === 'PENDING_REVIEW').length;
      const activeViolations = mockRuleViolations.filter((v) => v.action === 'BLOCK').length;
      const unverified = mockGeoCollateral.filter((g) => g.verificationStatus !== 'VERIFIED').length;

      setSummary({
        totalFraudAlerts: alerts.length + 3, // include mock
        highRiskAlerts: highRisk + 2,
        pendingReview: pending + 1,
        ruleViolations: mockRuleViolations.length,
        activeViolations,
        geoCollateral: mockGeoCollateral.length + collateralData.length,
        unverifiedLocations: unverified,
        reportDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load audit report data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered fraud alerts
  const allFraudAlerts: FraudAlertRow[] = fraudAlerts;
  const filteredFraudAlerts = allFraudAlerts.filter((a) => {
    if (fraudFilter === 'All') return true;
    if (fraudFilter === 'High Risk') return a.risk_score >= 80;
    if (fraudFilter === 'Pending') return a.status === 'PENDING_REVIEW';
    if (fraudFilter === 'Escalated') return a.status === 'ESCALATED';
    return true;
  });

  const filteredViolations = mockRuleViolations.filter((v) => {
    if (violationFilter === 'All') return true;
    if (violationFilter === 'BLOCK') return v.action === 'BLOCK';
    if (violationFilter === 'WARN') return v.action === 'WARN';
    if (violationFilter === 'HIGH') return v.severity === 'HIGH';
    return true;
  });

  // PDF Export handler
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/audit-report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: reportDateFrom,
          dateTo: reportDateTo,
          fraudAlerts: allFraudAlerts,
          ruleViolations: mockRuleViolations,
          geoCollateral: mockGeoCollateral,
          summary,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report-regulator-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const tabs = [
    { id: 'fraud' as const, label: 'Fraud Alerts', icon: ShieldAlert, count: summary?.totalFraudAlerts ?? 0 },
    { id: 'violations' as const, label: 'Rule Violations', icon: Scale, count: summary?.ruleViolations ?? 0 },
    { id: 'geomapping' as const, label: 'Geomapped Collateral', icon: Map, count: summary?.geoCollateral ?? 0 },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Page Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Regulatory Audit Report</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Consolidated fraud alerts, compliance violations, and geomapped collateral for regulator submission
          </p>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground ml-10 mt-1">
              Last refreshed: {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-border rounded-lg px-3 py-1.5">
            <Calendar size={13} className="text-muted-foreground" />
            <input
              type="date"
              value={reportDateFrom}
              onChange={(e) => setReportDateFrom(e.target.value)}
              className="text-xs bg-transparent border-none outline-none text-foreground"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={reportDateTo}
              onChange={(e) => setReportDateTo(e.target.value)}
              className="text-xs bg-transparent border-none outline-none text-foreground"
            />
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isExporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            {isExporting ? 'Generating PDF…' : 'Export PDF for Regulator'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Report Metadata Banner */}
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-5 py-3">
          <Building2 size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">EXIM Bank Tanzania — Regulatory Submission</p>
            <p className="text-xs text-muted-foreground">
              Report Period: {reportDateFrom ? formatDate(reportDateFrom) : '—'} to {reportDateTo ? formatDate(reportDateTo) : '—'} &nbsp;·&nbsp; Generated: {summary?.reportDate ?? '—'} &nbsp;·&nbsp; Classification: Confidential
            </p>
          </div>
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
            For Regulator Use
          </span>
        </div>

        {/* KPI Summary */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl p-5 border border-border bg-white animate-pulse h-28" />
            ))}
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Fraud Alerts"
              value={summary.totalFraudAlerts}
              sub={`${summary.highRiskAlerts} high risk · ${summary.pendingReview} pending review`}
              icon={ShieldAlert}
              variant={summary.highRiskAlerts > 0 ? 'danger' : 'default'}
            />
            <SummaryCard
              label="Rule Violations"
              value={summary.ruleViolations}
              sub={`${summary.activeViolations} blocking violations`}
              icon={Scale}
              variant={summary.activeViolations > 0 ? 'warning' : 'default'}
            />
            <SummaryCard
              label="Geomapped Collateral"
              value={summary.geoCollateral}
              sub={`${summary.unverifiedLocations} unverified locations`}
              icon={Map}
              variant={summary.unverifiedLocations > 0 ? 'warning' : 'success'}
            />
            <SummaryCard
              label="Compliance Status"
              value={summary.activeViolations > 2 ? 'At Risk' : 'Monitored'}
              sub="Based on active violations"
              icon={Activity}
              variant={summary.activeViolations > 2 ? 'danger' : 'warning'}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
          <div className="flex border-b border-border">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    isActive
                      ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-gray-50'
                  }`}
                >
                  <TabIcon size={15} />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive ? 'bg-primary/15 text-primary' : 'bg-gray-100 text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {/* ── Fraud Alerts Tab ── */}
            {activeTab === 'fraud' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader
                    title="AI-Detected Fraud Alerts"
                    sub="OpenAI-powered analysis: duplicate titles, identity mismatches, valuation anomalies"
                    icon={ShieldAlert}
                  />
                  <div className="flex items-center gap-2">
                    <Filter size={13} className="text-muted-foreground" />
                    <select
                      value={fraudFilter}
                      onChange={(e) => setFraudFilter(e.target.value)}
                      className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground outline-none"
                    >
                      {['All', 'High Risk', 'Pending', 'Escalated'].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredFraudAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No fraud alerts found for the selected filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Alert Type</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Collateral ID</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Risk Score</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Confidence</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Status</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Description</th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Detected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredFraudAlerts.map((alert) => {
                          const TypeIcon = alertTypeIcon[alert.alert_type] ?? AlertTriangle;
                          const riskLevel = alert.risk_score >= 80 ? 'HIGH' : alert.risk_score >= 50 ? 'MEDIUM' : 'LOW';
                          return (
                            <tr key={alert.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    riskLevel === 'HIGH' ? 'bg-red-100' : riskLevel === 'MEDIUM' ? 'bg-amber-100' : 'bg-blue-100'
                                  }`}>
                                    <TypeIcon size={13} className={
                                      riskLevel === 'HIGH' ? 'text-red-600' : riskLevel === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'
                                    } />
                                  </div>
                                  <span className="text-xs font-medium text-foreground whitespace-nowrap">
                                    {alertTypeLabel[alert.alert_type] ?? alert.alert_type}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-xs font-mono text-primary">{alert.collateral_id ?? '—'}</span>
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        alert.risk_score >= 80 ? 'bg-red-500' : alert.risk_score >= 50 ? 'bg-amber-500' : 'bg-blue-500'
                                      }`}
                                      style={{ width: `${alert.risk_score}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold tabular-nums ${
                                    alert.risk_score >= 80 ? 'text-red-600' : alert.risk_score >= 50 ? 'text-amber-600' : 'text-blue-600'
                                  }`}>{alert.risk_score.toFixed(1)}</span>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className="text-xs text-muted-foreground tabular-nums">{alert.confidence.toFixed(1)}%</span>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[alert.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {alert.status.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="py-3 pr-4 max-w-xs">
                                <p className="text-xs text-muted-foreground truncate">
                                  {(alert.details as any)?.description ?? JSON.stringify(alert.details).slice(0, 60)}
                                </p>
                              </td>
                              <td className="py-3">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(alert.created_at)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Rule Violations Tab ── */}
            {activeTab === 'violations' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader
                    title="Compliance Rule Violations"
                    sub="LTV breaches, deadline violations, and eligibility failures triggering BLOCK or WARN actions"
                    icon={Scale}
                  />
                  <div className="flex items-center gap-2">
                    <Filter size={13} className="text-muted-foreground" />
                    <select
                      value={violationFilter}
                      onChange={(e) => setViolationFilter(e.target.value)}
                      className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-white text-foreground outline-none"
                    >
                      {['All', 'BLOCK', 'WARN', 'HIGH'].map((f) => (
                        <option key={f} value={f}>{f === 'All' ? 'All Violations' : f === 'HIGH' ? 'High Severity' : `Action: ${f}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Rule</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Type</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Action</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Severity</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Collateral</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Obligor</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Message</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Triggered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredViolations.map((v) => (
                        <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="text-xs font-medium text-foreground">{v.ruleName}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{v.ruleType}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              v.action === 'BLOCK' ? 'bg-red-100 text-red-700 border border-red-200' :
                              v.action === 'WARN'? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>{v.action}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityBadge[v.severity]}`}>{v.severity}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs font-mono text-primary">{v.collateralId}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs text-foreground">{v.obligor}</span>
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            <p className="text-xs text-muted-foreground truncate">{v.message}</p>
                          </td>
                          <td className="py-3">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(v.triggeredAt)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Violation summary by type */}
                <div className="mt-6 grid grid-cols-3 gap-4">
                  {['LTV', 'DEADLINE', 'ELIGIBILITY'].map((type) => {
                    const count = mockRuleViolations.filter((v) => v.ruleType === type).length;
                    const blocking = mockRuleViolations.filter((v) => v.ruleType === type && v.action === 'BLOCK').length;
                    return (
                      <div key={type} className="bg-gray-50 rounded-lg p-4 border border-border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{type} Violations</p>
                        <p className="text-2xl font-bold text-foreground font-mono">{count}</p>
                        <p className="text-xs text-muted-foreground mt-1">{blocking} blocking · {count - blocking} warnings</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Geomapped Collateral Tab ── */}
            {activeTab === 'geomapping' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader
                    title="Geomapped Collateral Locations"
                    sub="GPS-verified collateral addresses, risk zones, and location validation status"
                    icon={Map}
                  />
                </div>

                {/* Geo summary cards */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Verified Locations', count: mockGeoCollateral.filter((g) => g.verificationStatus === 'VERIFIED').length, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                    { label: 'Unverified Locations', count: mockGeoCollateral.filter((g) => g.verificationStatus === 'UNVERIFIED').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                    { label: 'Address Mismatches', count: mockGeoCollateral.filter((g) => g.verificationStatus === 'MISMATCH').length, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-lg p-4 border ${item.bg}`}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
                      <p className={`text-2xl font-bold font-mono ${item.color}`}>{item.count}</p>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Collateral ID</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Obligor</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Type</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Address</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Coordinates</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Risk Zone</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4">Status</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mockGeoCollateral.map((geo) => (
                        <tr key={geo.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pr-4">
                            <span className="text-xs font-mono text-primary">{geo.collateralId}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs font-medium text-foreground">{geo.obligor}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs text-muted-foreground">{geo.type}</span>
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            <div className="flex items-start gap-1.5">
                              <MapPin size={11} className="text-muted-foreground mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground truncate">{geo.address}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-xs font-mono text-muted-foreground">{geo.coordinates}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskZoneBadge[geo.riskZone] ?? 'bg-gray-100 text-gray-600'}`}>
                              {geo.riskZone}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                              geo.status === 'Perfected' ? 'bg-green-100 text-green-700 border-green-200' :
                              geo.status === 'Overdue'? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}>{geo.status}</span>
                          </td>
                          <td className="py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${verificationBadge[geo.verificationStatus]}`}>
                              {geo.verificationStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Regulator Submission Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">Regulator Submission Notes</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>This report is generated from live Supabase data and includes AI-analyzed fraud alerts from OpenAI.</li>
                <li>All fraud alerts with status <strong>PENDING_REVIEW</strong> or <strong>ESCALATED</strong> require immediate attention before submission.</li>
                <li>Geomapped collateral with <strong>MISMATCH</strong> verification status indicates address discrepancies that must be resolved.</li>
                <li>Rule violations with <strong>BLOCK</strong> action represent hard compliance failures requiring remediation.</li>
                <li>Export the PDF using the button above for the official regulator-formatted document.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
