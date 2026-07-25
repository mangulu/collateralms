'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield, ShieldAlert, Activity, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { CollateralRecord, CollateralStatus } from '@/lib/supabase/collateralService';
import { fetchFraudAlerts, FraudAlertRow } from '@/lib/supabase/fraudAlertService';
import { perfectionService, PerfectionRequest } from '@/lib/supabase/perfectionService';

const fraudAlertTypeLabels: Record<string, string> = {
  DUPLICATE_TITLE: 'Duplicate Title',
  IDENTITY_MISMATCH: 'Identity Mismatch',
  VALUATION_ANOMALY: 'Valuation Anomaly',
  EARLY_WARNING: 'Early Warning',
  DOCUMENT_FORGERY: 'Document Forgery',
};

const fraudStatusColors: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  FALSE_POSITIVE: 'bg-gray-100 text-gray-600',
  ESCALATED: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

function getPerfectionTimeline(status: CollateralStatus) {
  const steps = [
    { step: 'Security Document Executed', statuses: ['Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'] },
    { step: 'Collateral Registered in CMS', statuses: ['Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'] },
    { step: 'Legal Review & Approval', statuses: ['Under Review', 'Perfected', 'Monitoring', 'Released'] },
    { step: 'Registry Submission Filed', statuses: ['Perfected', 'Monitoring', 'Released'] },
    { step: 'Registry Confirmation Received', statuses: ['Perfected', 'Monitoring', 'Released'] },
    { step: 'Perfection Confirmed', statuses: ['Perfected', 'Released'] },
  ];
  return steps.map(s => ({ step: s.step, done: s.statuses.includes(status) }));
}

const workflowStatusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  Approved: 'bg-green-100 text-green-700',
  Perfected: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Returned: 'bg-orange-100 text-orange-700',
};

export default function RiskComplianceSidebarCard({ collateral }: { collateral: CollateralRecord }) {
  const [activePanel, setActivePanel] = useState<'fraud' | 'workflow'>('fraud');
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [fraudLoading, setFraudLoading] = useState(true);
  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  useEffect(() => {
    fetchFraudAlerts()
      .then((data) => {
        setAlerts(data.filter((a) => a.collateral_id === collateral.id || a.collateral_id === collateral.collateralId));
      })
      .catch(() => {})
      .finally(() => setFraudLoading(false));
  }, [collateral.id, collateral.collateralId]);

  useEffect(() => {
    perfectionService.getAll()
      .then((data) => {
        setRequests(data.filter((r) => r.collateralId === collateral.collateralId || r.collateralRecordId === collateral.id));
      })
      .catch(() => {})
      .finally(() => setWorkflowLoading(false));
  }, [collateral.id, collateral.collateralId]);

  const timeline = getPerfectionTimeline(collateral.status);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Risk &amp; Compliance</h2>
      </div>
      <div className="flex border-b border-border mx-5">
        {(['fraud', 'workflow'] as const).map((panel) => (
          <button key={panel} onClick={() => setActivePanel(panel)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-600 border-b-2 transition-colors -mb-px ${activePanel === panel ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {panel === 'fraud' ? <ShieldAlert size={12} /> : <Activity size={12} />}
            {panel === 'fraud' ? 'Fraud' : 'Workflow'}
            {panel === 'fraud' && alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-700">{alerts.length}</span>
            )}
          </button>
        ))}
      </div>
      <div className="p-5">
        {activePanel === 'fraud' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">AI-detected fraud signals</p>
              <Link href="/fraud-prevention" className="text-xs text-primary hover:underline flex items-center gap-1">View All <ChevronRight size={11} /></Link>
            </div>
            {fraudLoading ? (
              <div className="flex items-center justify-center py-6">
                <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <p className="text-sm text-green-700 font-500">No fraud alerts detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-600 text-red-700">{fraudAlertTypeLabels[alert.alert_type] ?? alert.alert_type}</span>
                      <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded ${fraudStatusColors[alert.status] ?? 'bg-gray-100 text-gray-600'}`}>{alert.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-red-600">Risk: <strong>{alert.risk_score}</strong></span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-red-600">Conf: <strong>{alert.confidence}%</strong></span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {activePanel === 'workflow' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Perfection progress</p>
              <Link href="/perfection-workflow" className="text-xs text-primary hover:underline flex items-center gap-1">View All <ChevronRight size={11} /></Link>
            </div>
            <div className="space-y-2 mb-5">
              {timeline.map((step, idx) => (
                <div key={`step-${idx}`} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {step.done ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-700">{idx + 1}</span>}
                  </div>
                  <p className={`text-xs ${step.done ? 'text-foreground font-500' : 'text-muted-foreground'}`}>{step.step}</p>
                </div>
              ))}
            </div>
            {workflowLoading ? (
              <div className="flex items-center justify-center py-4">
                <svg className="animate-spin w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : requests.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-2">Perfection Requests</p>
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div>
                      <p className="text-xs font-500 text-foreground">{req.collateralId}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{req.submittedByName} · {new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded ${workflowStatusColors[req.requestStatus] ?? 'bg-gray-100 text-gray-600'}`}>{req.requestStatus}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
