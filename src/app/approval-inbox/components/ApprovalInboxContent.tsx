'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, RotateCcw, Clock, Eye, Search, Filter, ChevronDown, ChevronRight, MessageSquare, AlertCircle, Loader2, Building2, Calendar, User, Tag, RefreshCw, CheckSquare, X, Send, TrendingUp, TrendingDown, Minus, BarChart2, Timer, Layers, Sparkles, ShieldAlert, ListChecks, FileText, Bell, Smartphone, Wifi, WifiOff, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { perfectionService, PerfectionRequest, PerfectionRequestStatus } from '@/lib/supabase/perfectionService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import { classifyCollateralDocument, DocumentClassificationResult } from '@/lib/ai/documentClassificationService';
import { useApprovalQueueRealtime } from '@/lib/hooks/useApprovalQueueRealtime';
import {
  requestDesktopPermission,
  notifyPerfectionRequest,
  notifyReleaseRequest,
  sendPerfectionSmsAlert,
  sendReleaseSmsAlert,
} from '@/lib/approvalNotifications';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'approve' | 'reject' | 'request_modification';

interface ActionModalState {
  open: boolean;
  request: PerfectionRequest | null;
  action: ActionType | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PerfectionRequestStatus, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  Draft:         { label: 'Draft',        textColor: 'text-gray-600',   bgColor: 'bg-gray-100',   borderColor: 'border-gray-200' },
  Submitted:     { label: 'Submitted',    textColor: 'text-blue-700',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
  'Under Review':{ label: 'Under Review', textColor: 'text-amber-700',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200' },
  Approved:      { label: 'Approved',     textColor: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200' },
  Perfected:     { label: 'Perfected',    textColor: 'text-emerald-700',bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  Rejected:      { label: 'Rejected',     textColor: 'text-red-700',    bgColor: 'bg-red-50',     borderColor: 'border-red-200' },
  Returned:      { label: 'Returned',     textColor: 'text-orange-700', bgColor: 'bg-orange-50',  borderColor: 'border-orange-200' },
};

const PRIORITY_CONFIG: Record<string, { textColor: string; bgColor: string; dot: string }> = {
  High:   { textColor: 'text-red-700',   bgColor: 'bg-red-50 border border-red-200',   dot: 'bg-red-500' },
  Normal: { textColor: 'text-gray-600',  bgColor: 'bg-gray-50 border border-gray-200', dot: 'bg-gray-400' },
  Low:    { textColor: 'text-blue-600',  bgColor: 'bg-blue-50 border border-blue-200', dot: 'bg-blue-400' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Collateral Detail Panel ──────────────────────────────────────────────────

function CollateralDetailPanel({ collateralId }: { collateralId: string }) {
  const [record, setRecord] = useState<CollateralRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    collateralService.getAll().then((all) => {
      if (cancelled) return;
      const found = all.find(
        (c) => c.collateralId === collateralId || c.id === collateralId
      ) ?? null;
      setRecord(found);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [collateralId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        Loading collateral details…
      </div>
    );
  }

  if (!record) {
    return (
      <div className="py-4 text-sm text-gray-400 italic">
        Collateral record not found for ID: {collateralId}
      </div>
    );
  }

  const rows: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Collateral ID',   value: record.collateralId },
    { label: 'Type',            value: record.type },
    { label: 'Obligor',         value: record.obligor },
    { label: 'Obligor ID',      value: record.obligorId },
    { label: 'Facility ID',     value: record.facilityId },
    { label: 'Value (TSh)',     value: record.valueTSh },
    { label: 'Registry',        value: record.registry },
    { label: 'Status',          value: record.status },
    { label: 'Reg. Date',       value: formatDate(record.registrationDate) },
    { label: 'Perfection Deadline', value: formatDate(record.perfectionDeadline) },
    { label: 'Assigned Officer',value: record.assignedOfficer || '—' },
    { label: 'LTV Ratio',       value: record.ltvRatio != null ? `${(record.ltvRatio * 100).toFixed(1)}%` : '—' },
    { label: 'Valuation (TSh)', value: record.valuationAmount != null ? record.valuationAmount.toLocaleString() : '—' },
    { label: 'Available Equity',value: record.availableEquity != null ? record.availableEquity.toLocaleString() : '—' },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
          <span className="text-gray-800 font-medium mt-0.5">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Document Classification Panel ───────────────────────────────────────────

interface DocumentClassificationPanelProps {
  collateralId: string;
  collateralType: string;
  obligor: string;
  registry: string;
}

const CONFIDENCE_CONFIG: Record<string, { textColor: string; bgColor: string; borderColor: string }> = {
  High:   { textColor: 'text-green-700',  bgColor: 'bg-green-50',  borderColor: 'border-green-200' },
  Medium: { textColor: 'text-amber-700',  bgColor: 'bg-amber-50',  borderColor: 'border-amber-200' },
  Low:    { textColor: 'text-red-700',    bgColor: 'bg-red-50',    borderColor: 'border-red-200' },
};

function DocumentClassificationPanel({ collateralId, collateralType, obligor, registry }: DocumentClassificationPanelProps) {
  const [result, setResult] = useState<DocumentClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const runClassification = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const classification = await classifyCollateralDocument(
        collateralId,
        collateralType,
        obligor,
        registry
      );
      setResult(classification);
    } catch (e: any) {
      setError('Classification failed. Please try again.');
    } finally {
      setLoading(false);
      setRan(true);
    }
  }, [collateralId, collateralType, obligor, registry]);

  const confidenceCfg = result ? (CONFIDENCE_CONFIG[result.confidence] ?? CONFIDENCE_CONFIG['Medium']) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-800">AI Document Classification</p>
            <p className="text-xs text-gray-500">Powered by OpenAI</p>
          </div>
        </div>
        {!loading && (
          <button
            onClick={runClassification}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 bg-violet-100 hover:bg-violet-200 rounded-lg transition-colors"
          >
            <Sparkles size={12} />
            {ran ? 'Re-classify' : 'Classify Document'}
          </button>
        )}
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-violet-600">
            <Loader2 size={13} className="animate-spin" />
            Classifying…
          </div>
        )}
      </div>

      {/* Panel Body */}
      <div className="px-4 py-3">
        {!ran && !loading && (
          <p className="text-xs text-gray-400 italic py-2">
            Click <strong>Classify Document</strong> to automatically identify the document type and required verification steps for this collateral.
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            {/* Document Type + Confidence */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-violet-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Document Type</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{result.documentType}</p>
                </div>
              </div>
              {confidenceCfg && (
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${confidenceCfg.textColor} ${confidenceCfg.bgColor} ${confidenceCfg.borderColor}`}>
                  {result.confidence} Confidence
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {result.description}
            </p>

            {/* Required Actions */}
            {result.requiredActions.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ListChecks size={13} className="text-blue-500" />
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Required Verification Steps</p>
                </div>
                <ul className="space-y-1">
                  {result.requiredActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">{i + 1}</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Flags */}
            {result.riskFlags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldAlert size={13} className="text-amber-500" />
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Risk Flags</p>
                </div>
                <ul className="space-y-1">
                  {result.riskFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                      <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.riskFlags.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                <CheckCircle size={12} className="text-green-500" />
                No risk flags identified for this document type.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

interface ActionModalProps {
  state: ActionModalState;
  onClose: () => void;
  onSubmit: (action: ActionType, notes: string) => Promise<void>;
  submitting: boolean;
}

function ActionModal({ state, onClose, onSubmit, submitting }: ActionModalProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (state.open) setNotes('');
  }, [state.open]);

  if (!state.open || !state.request || !state.action) return null;

  const config = {
    approve: {
      title: 'Approve Request',
      description: 'Approve this perfection request. The collateral will be marked as Approved/Perfected.',
      placeholder: 'Add approval notes (optional)…',
      buttonLabel: 'Approve',
      buttonStyle: 'bg-green-600 hover:bg-green-700 text-white',
      icon: <CheckCircle size={20} className="text-green-600" />,
      required: false,
    },
    reject: {
      title: 'Reject Request',
      description: 'Reject this perfection request. Please provide a reason for rejection.',
      placeholder: 'Reason for rejection (required)…',
      buttonLabel: 'Reject',
      buttonStyle: 'bg-red-600 hover:bg-red-700 text-white',
      icon: <XCircle size={20} className="text-red-600" />,
      required: true,
    },
    request_modification: {
      title: 'Request Modification',
      description: 'Return this request to the submitter for revision. Describe what needs to be changed.',
      placeholder: 'Describe the required modifications (required)…',
      buttonLabel: 'Send Back',
      buttonStyle: 'bg-orange-500 hover:bg-orange-600 text-white',
      icon: <RotateCcw size={20} className="text-orange-500" />,
      required: true,
    },
  }[state.action];

  const canSubmit = !config.required || notes.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {state.request.collateralId} · {state.request.obligor}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">{config.description}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Notes {config.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(state.action!, notes)}
            disabled={!canSubmit || submitting}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${config.buttonStyle}`}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {config.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Row ──────────────────────────────────────────────────────────────

interface RequestRowProps {
  request: PerfectionRequest;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: ActionType) => void;
  canAct: boolean;
}

function RequestRow({ request, expanded, onToggle, onAction, canAct }: RequestRowProps) {
  const statusCfg = STATUS_CONFIG[request.requestStatus] ?? STATUS_CONFIG['Submitted'];
  const priorityCfg = PRIORITY_CONFIG[request.priority] ?? PRIORITY_CONFIG['Normal'];
  const days = daysUntil(request.perfectionDeadline);
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 7;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${expanded ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Row Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50/60 transition-colors"
      >
        {/* Expand icon */}
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Priority dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityCfg.dot}`} title={`${request.priority} priority`} />

        {/* Main info */}
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{request.collateralId}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{request.obligor}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Type</p>
            <p className="text-sm text-gray-700 font-medium truncate">{request.collateralType}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Submitted by</p>
            <p className="text-sm text-gray-700 font-medium truncate">{request.submittedByName || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Deadline</p>
            <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-700'}`}>
              {formatDate(request.perfectionDeadline)}
              {isOverdue && <span className="ml-1 text-xs font-normal">(overdue)</span>}
              {isUrgent && !isOverdue && <span className="ml-1 text-xs font-normal">({days}d left)</span>}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.textColor} ${statusCfg.bgColor} ${statusCfg.borderColor}`}>
          {statusCfg.label}
        </span>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40">
          <div className="px-6 py-5 space-y-5">
            {/* Meta row */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Submitted:</span>
                <span className="font-medium">{formatDateTime(request.submittedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Tag size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Registry:</span>
                <span className="font-medium">{request.registry}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Reviewed by:</span>
                <span className="font-medium">{request.reviewedByName || 'Not yet reviewed'}</span>
              </div>
              {request.decisionNotes && (
                <div className="flex items-start gap-1.5 text-gray-600 w-full">
                  <MessageSquare size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-500 shrink-0">Decision notes:</span>
                  <span className="font-medium text-gray-700">{request.decisionNotes}</span>
                </div>
              )}
            </div>

            {/* Collateral Details */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 size={12} />
                Collateral Details
              </h4>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <CollateralDetailPanel collateralId={request.collateralId} />
              </div>
            </div>

            {/* AI Document Classification */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={12} />
                Document Classification
              </h4>
              <DocumentClassificationPanel
                collateralId={request.collateralId}
                collateralType={request.collateralType}
                obligor={request.obligor}
                registry={request.registry}
              />
            </div>

            {/* Action Buttons */}
            {canAct && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onAction('approve')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <CheckCircle size={15} />
                  Approve
                </button>
                <button
                  onClick={() => onAction('request_modification')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  <RotateCcw size={15} />
                  Request Modification
                </button>
                <button
                  onClick={() => onAction('reject')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            )}

            {!canAct && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Actions are available to Legal Officers and System Admins for Submitted or Under Review requests.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

interface KPICardsProps {
  requests: PerfectionRequest[];
}

function computeAvgApprovalHours(requests: PerfectionRequest[]): number | null {
  const withBoth = requests.filter(
    (r) => r.submittedAt && r.reviewedAt
  );
  if (withBoth.length === 0) return null;
  const totalMs = withBoth.reduce((sum, r) => {
    return sum + (new Date(r.reviewedAt!).getTime() - new Date(r.submittedAt!).getTime());
  }, 0);
  return totalMs / withBoth.length / (1000 * 60 * 60);
}

function computeSLACompliance(requests: PerfectionRequest[]): number {
  if (requests.length === 0) return 100;
  const compliant = requests.filter((r) => {
    const d = daysUntil(r.perfectionDeadline);
    return d === null || d >= 0;
  }).length;
  return Math.round((compliant / requests.length) * 100);
}

interface BottleneckEntry {
  type: string;
  count: number;
  highPriority: number;
}

function computeBottlenecks(requests: PerfectionRequest[]): BottleneckEntry[] {
  const map: Record<string, BottleneckEntry> = {};
  for (const r of requests) {
    const t = r.collateralType || 'Unknown';
    if (!map[t]) map[t] = { type: t, count: 0, highPriority: 0 };
    map[t].count++;
    if (r.priority === 'High') map[t].highPriority++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 4);
}

function KPICards({ requests }: KPICardsProps) {
  const queueDepth = requests.length;
  const submitted = requests.filter((r) => r.requestStatus === 'Submitted').length;
  const underReview = requests.filter((r) => r.requestStatus === 'Under Review').length;
  const highPriority = requests.filter((r) => r.priority === 'High').length;

  const slaCompliance = computeSLACompliance(requests);
  const slaBreached = requests.filter((r) => {
    const d = daysUntil(r.perfectionDeadline);
    return d !== null && d < 0;
  }).length;
  const slaNearBreach = requests.filter((r) => {
    const d = daysUntil(r.perfectionDeadline);
    return d !== null && d >= 0 && d <= 3;
  }).length;

  const avgHours = computeAvgApprovalHours(requests);
  const avgDisplay = avgHours === null
    ? '—'
    : avgHours < 24
      ? `${avgHours.toFixed(1)}h`
      : `${(avgHours / 24).toFixed(1)}d`;
  const avgTrend: 'good' | 'warn' | 'neutral' =
    avgHours === null ? 'neutral' : avgHours <= 24 ? 'good' : avgHours <= 72 ? 'warn' : 'neutral';

  const bottlenecks = computeBottlenecks(requests);
  const maxCount = bottlenecks[0]?.count ?? 1;

  return (
    <div className="grid grid-cols-4 gap-4 px-6 pt-5 pb-2">
      {/* 1 — Queue Depth */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <Layers size={16} className="text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Queue Depth</span>
          </div>
          {highPriority > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              {highPriority} urgent
            </span>
          )}
        </div>
        <div>
          <p className="text-3xl font-bold text-gray-900 leading-none">{queueDepth}</p>
          <p className="text-xs text-gray-400 mt-1">pending approvals</p>
        </div>
        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span className="text-xs text-gray-500">{submitted} awaiting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="text-xs text-gray-500">{underReview} in review</span>
          </div>
        </div>
      </div>

      {/* 2 — SLA Compliance */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${slaCompliance >= 80 ? 'bg-green-50' : slaCompliance >= 60 ? 'bg-amber-50' : 'bg-red-50'}`}>
              {slaCompliance >= 80
                ? <TrendingUp size={16} className="text-green-600" />
                : slaCompliance >= 60
                  ? <Minus size={16} className="text-amber-600" />
                  : <TrendingDown size={16} className="text-red-600" />}
            </div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SLA Compliance</span>
          </div>
        </div>
        <div>
          <p className={`text-3xl font-bold leading-none ${slaCompliance >= 80 ? 'text-green-700' : slaCompliance >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
            {slaCompliance}%
          </p>
          <p className="text-xs text-gray-400 mt-1">within deadline</p>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${slaCompliance >= 80 ? 'bg-green-500' : slaCompliance >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${slaCompliance}%` }}
            />
          </div>
          <div className="flex items-center gap-3">
            {slaBreached > 0 && (
              <span className="text-xs text-red-600 font-medium">{slaBreached} breached</span>
            )}
            {slaNearBreach > 0 && (
              <span className="text-xs text-amber-600 font-medium">{slaNearBreach} at risk</span>
            )}
            {slaBreached === 0 && slaNearBreach === 0 && (
              <span className="text-xs text-green-600 font-medium">All on track</span>
            )}
          </div>
        </div>
      </div>

      {/* 3 — Avg Approval Time */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${avgTrend === 'good' ? 'bg-green-50' : avgTrend === 'warn' ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <Timer size={16} className={avgTrend === 'good' ? 'text-green-600' : avgTrend === 'warn' ? 'text-amber-600' : 'text-gray-500'} />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Approval Time</span>
        </div>
        <div>
          <p className={`text-3xl font-bold leading-none ${avgTrend === 'good' ? 'text-green-700' : avgTrend === 'warn' ? 'text-amber-700' : 'text-gray-700'}`}>
            {avgDisplay}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {avgHours === null ? 'no completed reviews yet' : 'from submission to decision'}
          </p>
        </div>
        <div className="pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {avgTrend === 'good' ?'✓ Within 24h target'
              : avgTrend === 'warn' ?'⚠ Exceeds 24h target' :'Target: ≤ 24h per request'}
          </p>
        </div>
      </div>

      {/* 4 — Bottleneck by Type */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
            <BarChart2 size={16} className="text-purple-600" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bottleneck by Type</span>
        </div>
        {bottlenecks.length === 0 ? (
          <p className="text-xs text-gray-400 italic mt-1">No data</p>
        ) : (
          <div className="space-y-2 flex-1">
            {bottlenecks.map((b) => (
              <div key={b.type} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 font-medium truncate max-w-[120px]" title={b.type}>{b.type}</span>
                  <div className="flex items-center gap-1.5">
                    {b.highPriority > 0 && (
                      <span className="text-xs text-red-500 font-semibold">{b.highPriority}↑</span>
                    )}
                    <span className="text-xs font-bold text-gray-800">{b.count}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b.highPriority > 0 ? 'bg-red-400' : 'bg-purple-400'}`}
                    style={{ width: `${Math.round((b.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PENDING_STATUSES: PerfectionRequestStatus[] = ['Submitted', 'Under Review'];

export default function ApprovalInboxContent() {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role ?? '';

  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PerfectionRequestStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | string>('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, request: null, action: null });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ─── Realtime & Notification State ─────────────────────────────────────────
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>('default');
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [showSmsInput, setShowSmsInput] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [liveAlertCount, setLiveAlertCount] = useState(0);
  const requestIdsRef = useRef<Set<string>>(new Set());

  // Initialise desktop permission state (client-only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermission(Notification.permission);
    }
  }, []);

  const handleRequestDesktopPermission = useCallback(async () => {
    const perm = await requestDesktopPermission();
    setDesktopPermission(perm);
  }, []);

  // ─── Realtime listeners ─────────────────────────────────────────────────────
  useApprovalQueueRealtime({
    enabled: true,
    onPerfectionChange: useCallback(async (change) => {
      const rec = change.record;
      const status: string = rec?.request_status ?? '';
      const isPending = status === 'Submitted' || status === 'Under Review';

      if (!isPending) return;

      // Avoid duplicate alerts for the same request on initial load
      const id: string = rec?.id ?? '';
      if (change.event === 'INSERT') {
        if (requestIdsRef.current.has(id)) return;
        requestIdsRef.current.add(id);
      }

      setRealtimeConnected(true);
      setLiveAlertCount((n) => n + 1);

      // Reload the list silently
      setRefreshing(true);
      try {
        const all = await perfectionService.getAll();
        const pending = all.filter((r) => PENDING_STATUSES.includes(r.requestStatus));
        setRequests(pending);
        // Sync known IDs
        requestIdsRef.current = new Set(pending.map((r) => r.id));
      } catch { /* silent */ } finally {
        setRefreshing(false);
      }

      const payload = {
        requestId: id,
        collateralId: rec?.collateral_id ?? '',
        obligor: rec?.obligor ?? '',
        status,
        priority: rec?.priority ?? 'Normal',
      };

      // Desktop notification
      notifyPerfectionRequest(payload);

      // Optional SMS
      if (smsAlertsEnabled && smsPhone.trim()) {
        await sendPerfectionSmsAlert(payload, {
          phone: smsPhone.trim(),
          recipientName: userProfile?.full_name ?? undefined,
        });
      }
    }, [smsAlertsEnabled, smsPhone, userProfile]),

    onCollateralStatusChange: useCallback(async (change) => {
      const rec = change.record;
      const newStatus: string = rec?.status ?? '';
      const releaseStatuses = ['Release Pending', 'Discharge Requested', 'Under Release Review'];
      if (!releaseStatuses.includes(newStatus)) return;

      setRealtimeConnected(true);
      setLiveAlertCount((n) => n + 1);

      const payload = {
        collateralId: rec?.collateral_id ?? rec?.id ?? '',
        obligor: rec?.obligor ?? undefined,
        newStatus,
      };

      notifyReleaseRequest(payload);

      if (smsAlertsEnabled && smsPhone.trim()) {
        await sendReleaseSmsAlert(payload, {
          phone: smsPhone.trim(),
          recipientName: userProfile?.full_name ?? undefined,
        });
      }
    }, [smsAlertsEnabled, smsPhone, userProfile]),
  });

  const canActOnRequest = useCallback((req: PerfectionRequest): boolean => {
    if (!['legal_officer', 'system_admin'].includes(userRole)) return false;
    return PENDING_STATUSES.includes(req.requestStatus);
  }, [userRole]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const all = await perfectionService.getAll();
      const pending = all.filter((r) => PENDING_STATUSES.includes(r.requestStatus));
      setRequests(pending);
      requestIdsRef.current = new Set(pending.map((r) => r.id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load approval requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAction = useCallback(async (action: ActionType, notes: string) => {
    if (!actionModal.request || !userProfile) return;
    setSubmitting(true);
    const req = actionModal.request;
    const userId = userProfile.id ?? '';
    const userName = userProfile.full_name ?? userProfile.email ?? 'Reviewer';
    const role = userRole;

    try {
      if (action === 'approve') {
        await perfectionService.approve(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} approved successfully.`, type: 'success' });
      } else if (action === 'reject') {
        await perfectionService.reject(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} rejected.`, type: 'success' });
      } else if (action === 'request_modification') {
        await perfectionService.returnForRevision(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} returned for modification.`, type: 'success' });
      }
      setActionModal({ open: false, request: null, action: null });
      setExpandedId(null);
      await load(true);
    } catch (e: any) {
      setToast({ message: e?.message ?? 'Action failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [actionModal.request, userProfile, userRole, load]);

  // Filtered list
  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.collateralId.toLowerCase().includes(q) ||
      r.obligor.toLowerCase().includes(q) ||
      r.submittedByName.toLowerCase().includes(q) ||
      r.collateralType.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || r.requestStatus === statusFilter;
    const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats
  const submitted = requests.filter((r) => r.requestStatus === 'Submitted').length;
  const underReview = requests.filter((r) => r.requestStatus === 'Under Review').length;
  const highPriority = requests.filter((r) => r.priority === 'High').length;
  const overdue = requests.filter((r) => {
    const d = daysUntil(r.perfectionDeadline);
    return d !== null && d < 0;
  }).length;

  const isReviewer = ['legal_officer', 'system_admin'].includes(userRole);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                <LayoutGrid size={11} /> Workflows
              </Link>
              <ChevronRight size={11} className="text-gray-300" />
              <span className="text-xs text-gray-600 font-medium">Perfection Queue</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Perfection Queue</h1>
              {/* Realtime status indicator */}
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${realtimeConnected ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                {realtimeConnected
                  ? <><Wifi size={11} className="text-green-500" /> Live</>
                  : <><WifiOff size={11} className="text-gray-400" /> Connecting…</>}
              </div>
              {liveAlertCount > 0 && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  {liveAlertCount} live update{liveAlertCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Review pending loan perfection requests, compare collateral details, and take action.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Desktop notification toggle */}
            {desktopPermission !== 'granted' && (
              <button
                onClick={handleRequestDesktopPermission}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors"
                title="Enable desktop notifications for new approval requests"
              >
                <Bell size={13} />
                Enable Alerts
              </button>
            )}
            {desktopPermission === 'granted' && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg">
                <Bell size={13} className="text-green-600" />
                Alerts On
              </div>
            )}
            {/* SMS toggle */}
            <button
              onClick={() => setShowSmsInput((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                smsAlertsEnabled
                  ? 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' :'text-gray-600 bg-gray-100 border-gray-200 hover:bg-gray-200'
              }`}
              title="Configure SMS alerts for approval queue changes"
            >
              <Smartphone size={13} />
              SMS {smsAlertsEnabled ? 'On' : 'Off'}
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* SMS opt-in panel */}
        {showSmsInput && (
          <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Smartphone size={15} className="text-blue-500 shrink-0" />
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <p className="text-xs font-medium text-blue-800">
                Receive SMS alerts for new perfection &amp; release requests:
              </p>
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+255712345678"
                className="flex-1 min-w-40 max-w-56 text-sm border border-blue-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
              />
              <button
                onClick={() => {
                  if (smsPhone.trim()) {
                    setSmsAlertsEnabled(true);
                    setShowSmsInput(false);
                    setToast({ message: `SMS alerts enabled for ${smsPhone.trim()}`, type: 'success' });
                  }
                }}
                disabled={!smsPhone.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Enable SMS
              </button>
              {smsAlertsEnabled && (
                <button
                  onClick={() => { setSmsAlertsEnabled(false); setSmsPhone(''); setShowSmsInput(false); }}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                >
                  Disable
                </button>
              )}
            </div>
            <button onClick={() => setShowSmsInput(false)} className="p-1 rounded hover:bg-blue-100 transition-colors">
              <X size={14} className="text-blue-500" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Awaiting Review', value: submitted, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Clock size={16} className="text-blue-500" /> },
            { label: 'Under Review', value: underReview, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Eye size={16} className="text-amber-500" /> },
            { label: 'High Priority', value: highPriority, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertCircle size={16} className="text-red-500" /> },
            { label: 'Overdue', value: overdue, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle size={16} className="text-rose-500" /> },
          ].map(({ label, value, color, bg, border, icon }) => (
            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} ${border}`}>
              {icon}
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {!loading && !error && (
        <div className="bg-gray-50 border-b border-gray-100 shrink-0">
          <KPICards requests={requests} />
        </div>
      )}

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by collateral ID, obligor, officer…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-gray-50"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
            </select>
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-700"
          >
            <option value="all">All Priorities</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} of {requests.length} requests
          </span>
        </div>
      </div>

      {/* Role notice for non-reviewers */}
      {!isReviewer && (
        <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>
            You are viewing the approval inbox in <strong>read-only</strong> mode. Approve, reject, and modification actions are available to <strong>Legal Officers</strong> and <strong>System Admins</strong>.
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Loading pending requests…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => load()} className="text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <CheckSquare size={32} className="text-green-400" />
            <p className="text-base font-medium text-gray-600">
              {requests.length === 0 ? 'No pending requests' : 'No requests match your filters'}
            </p>
            <p className="text-sm text-gray-400">
              {requests.length === 0
                ? 'All loan perfection requests have been processed.' :'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              onAction={(action) => setActionModal({ open: true, request: req, action })}
              canAct={canActOnRequest(req)}
            />
          ))
        )}
      </div>

      {/* Action Modal */}
      <ActionModal
        state={actionModal}
        onClose={() => setActionModal({ open: false, request: null, action: null })}
        onSubmit={handleAction}
        submitting={submitting}
      />
    </div>
  );
}
