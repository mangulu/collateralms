'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Plus, ChevronDown, ChevronUp, Upload, FileText, Trash2, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowRight, History, Loader2, RefreshCw, Download } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import {
  registrySubmissionTrackerService,
  RegistrySubmission,
  RegistrySubmissionAudit,
  RegistrySubmissionStatus,
  PerfectionRegistryName,
  REGISTRY_NAMES,
} from '@/lib/supabase/registrySubmissionTrackerService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  collateral: CollateralRecord;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RegistrySubmissionStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}> = {
  Pending:      { label: 'Pending',      color: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-300',  icon: Clock },
  Submitted:    { label: 'Submitted',    color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300',  icon: ArrowRight },
  Acknowledged: { label: 'Acknowledged', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300', icon: CheckCircle2 },
  Registered:   { label: 'Registered',   color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-300', icon: CheckCircle2 },
  Rejected:     { label: 'Rejected',     color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-300',   icon: XCircle },
};

const NEXT_STATUS: Partial<Record<RegistrySubmissionStatus, RegistrySubmissionStatus>> = {
  Pending:      'Submitted',
  Submitted:    'Acknowledged',
  Acknowledged: 'Registered',
};

const REGISTRY_DESCRIPTIONS: Record<PerfectionRegistryName, string> = {
  'BRELA':              'Business assets, debentures & charges',
  'Lands Registry':     'Mortgages & title deeds',
  'TRA':                'Motor vehicle registration',
  'DSE/CSDR':           'Shares & securities',
  'Tanzania Shipping':  'Ship & vessel collateral',
  'Other':              'Other registry',
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RegistrySubmissionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Status Progress Bar ──────────────────────────────────────────────────────

const STATUS_STEPS: RegistrySubmissionStatus[] = ['Pending', 'Submitted', 'Acknowledged', 'Registered'];

function StatusProgressBar({ status }: { status: RegistrySubmissionStatus }) {
  const isRejected = status === 'Rejected';
  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="flex items-center gap-1 mt-2">
      {STATUS_STEPS.map((step, idx) => {
        const done = !isRejected && currentIdx >= idx;
        const active = !isRejected && currentIdx === idx;
        return (
          <React.Fragment key={step}>
            <div className={`flex items-center gap-1 ${active ? 'opacity-100' : done ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-700 border
                ${done ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                {done ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] font-500 hidden sm:block ${done ? 'text-green-700' : 'text-gray-400'}`}>{step}</span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded ${done && currentIdx > idx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
      {isRejected && (
        <span className="ml-2 text-xs text-red-600 font-600 flex items-center gap-1">
          <XCircle size={12} /> Rejected
        </span>
      )}
    </div>
  );
}

// ─── Audit Trail Panel ────────────────────────────────────────────────────────

function AuditTrailPanel({ submissionId }: { submissionId: string }) {
  const [trail, setTrail] = useState<RegistrySubmissionAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registrySubmissionTrackerService.getAuditTrail(submissionId)
      .then(setTrail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) return <div className="py-4 text-center text-xs text-muted-foreground">Loading audit trail…</div>;
  if (!trail.length) return <div className="py-4 text-center text-xs text-muted-foreground">No audit entries yet.</div>;

  return (
    <div className="space-y-2 mt-3">
      {trail.map((entry) => {
        const toCfg = STATUS_CONFIG[entry.toStatus];
        return (
          <div key={entry.id} className="flex items-start gap-3 p-2.5 bg-muted/20 rounded-lg">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${toCfg.bg} ${toCfg.border} border`}>
              <toCfg.icon size={11} className={toCfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.fromStatus && (
                  <>
                    <StatusBadge status={entry.fromStatus} />
                    <ArrowRight size={11} className="text-muted-foreground" />
                  </>
                )}
                <StatusBadge status={entry.toStatus} />
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {entry.changedByName ?? 'System'} · {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              {entry.notes && (
                <p className="text-xs text-foreground mt-0.5 italic">{entry.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Submission Card ──────────────────────────────────────────────────────────

interface SubmissionCardProps {
  submission: RegistrySubmission;
  collateralId: string;
  onRefresh: () => void;
  userId?: string;
  userName?: string;
}

function SubmissionCard({ submission, collateralId, onRefresh, userId, userName }: SubmissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<RegistrySubmissionStatus | null>(null);
  const [refInput, setRefInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [rejectionInput, setRejectionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const cfg = STATUS_CONFIG[submission.submissionStatus];
  const nextStatus = NEXT_STATUS[submission.submissionStatus];

  // Load signed URLs for documents
  useEffect(() => {
    if (!expanded || !submission.documentPaths.length) return;
    submission.documentPaths.forEach(async (path) => {
      if (docUrls[path]) return;
      const url = await registrySubmissionTrackerService.getDocumentUrl(path).catch(() => '');
      if (url) setDocUrls((prev) => ({ ...prev, [path]: url }));
    });
  }, [expanded, submission.documentPaths]);

  const handleAdvanceStatus = (status: RegistrySubmissionStatus) => {
    setTargetStatus(status);
    setRefInput('');
    setNotesInput('');
    setRejectionInput('');
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!targetStatus) return;
    setSaving(true);
    try {
      await registrySubmissionTrackerService.updateStatus({
        id: submission.id,
        newStatus: targetStatus,
        userId,
        userName,
        submissionRef: targetStatus === 'Submitted' ? refInput : undefined,
        acknowledgementRef: targetStatus === 'Acknowledged' ? refInput : undefined,
        registrationRef: targetStatus === 'Registered' ? refInput : undefined,
        rejectionReason: targetStatus === 'Rejected' ? rejectionInput : undefined,
        notes: notesInput || undefined,
      });
      setShowStatusModal(false);
      onRefresh();
    } catch (e: any) {
      alert(e.message ?? 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await registrySubmissionTrackerService.uploadDocument(submission.id, file, collateralId);
      onRefresh();
    } catch (err: any) {
      alert(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveDoc = async (path: string) => {
    if (!confirm('Remove this document from the submission?')) return;
    await registrySubmissionTrackerService.removeDocument(submission.id, path).catch(() => {});
    onRefresh();
  };

  const refLabel =
    targetStatus === 'Submitted' ? 'Submission Reference No.' :
    targetStatus === 'Acknowledged' ? 'Acknowledgement Reference No.' :
    targetStatus === 'Registered' ? 'Registration Reference No.' : '';

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${submission.submissionStatus === 'Registered' ? 'border-green-200' : submission.submissionStatus === 'Rejected' ? 'border-red-200' : 'border-border'}`}>
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-700 text-foreground">{submission.registryName}</span>
              <StatusBadge status={submission.submissionStatus} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{REGISTRY_DESCRIPTIONS[submission.registryName]}</p>
            <StatusProgressBar status={submission.submissionStatus} />
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Quick ref display */}
        {(submission.submissionRef || submission.registrationRef) && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {submission.submissionRef && (
              <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                Ref: {submission.submissionRef}
              </span>
            )}
            {submission.registrationRef && (
              <span className="text-[11px] font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                Reg: {submission.registrationRef}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {submission.submissionStatus !== 'Registered' && submission.submissionStatus !== 'Rejected' && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {nextStatus && (
              <button
                onClick={() => handleAdvanceStatus(nextStatus)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-colors"
              >
                <ArrowRight size={12} /> Mark as {nextStatus}
              </button>
            )}
            <button
              onClick={() => handleAdvanceStatus('Rejected')}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-600 hover:bg-red-50 transition-colors"
            >
              <XCircle size={12} /> Reject
            </button>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Timeline details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Created', value: new Date(submission.createdAt).toLocaleString(), by: submission.createdByName },
              submission.submittedAt ? { label: 'Submitted', value: new Date(submission.submittedAt).toLocaleString(), by: submission.submittedByName, ref: submission.submissionRef } : null,
              submission.acknowledgedAt ? { label: 'Acknowledged', value: new Date(submission.acknowledgedAt).toLocaleString(), by: submission.acknowledgedByName, ref: submission.acknowledgementRef } : null,
              submission.registeredAt ? { label: 'Registered', value: new Date(submission.registeredAt).toLocaleString(), by: submission.registeredByName, ref: submission.registrationRef } : null,
              submission.rejectedAt ? { label: 'Rejected', value: new Date(submission.rejectedAt).toLocaleString(), by: submission.rejectedByName } : null,
            ].filter(Boolean).map((item: any) => (
              <div key={item.label} className="p-2.5 bg-muted/20 rounded-lg">
                <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{item.label}</p>
                <p className="text-xs font-600 text-foreground">{item.value}</p>
                {item.by && <p className="text-[11px] text-muted-foreground">by {item.by}</p>}
                {item.ref && <p className="text-[11px] font-mono text-primary mt-0.5">Ref: {item.ref}</p>}
              </div>
            ))}
          </div>

          {submission.rejectionReason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-600 text-red-700 mb-0.5">Rejection Reason</p>
              <p className="text-xs text-red-600">{submission.rejectionReason}</p>
            </div>
          )}

          {submission.notes && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-600 text-muted-foreground mb-0.5">Notes</p>
              <p className="text-xs text-foreground">{submission.notes}</p>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-600 text-foreground uppercase tracking-wide">Supporting Documents</p>
              <div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleUpload} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  Attach
                </button>
              </div>
            </div>
            {submission.documentPaths.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No documents attached yet.</p>
            ) : (
              <div className="space-y-1.5">
                {submission.documentPaths.map((path) => {
                  const fileName = path.split('/').pop() ?? path;
                  return (
                    <div key={path} className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg group">
                      <FileText size={13} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground flex-1 truncate font-mono">{fileName}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {docUrls[path] && (
                          <a href={docUrls[path]} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded hover:bg-muted transition-colors">
                            <Download size={12} className="text-primary" />
                          </a>
                        )}
                        <button onClick={() => handleRemoveDoc(path)}
                          className="p-1 rounded hover:bg-red-50 transition-colors">
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Audit Trail Toggle */}
          <div>
            <button
              onClick={() => setShowAudit((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <History size={12} />
              {showAudit ? 'Hide' : 'Show'} Audit Trail
              {showAudit ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {showAudit && <AuditTrailPanel submissionId={submission.id} />}
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && targetStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-700 text-foreground mb-1">
              Update Status → <StatusBadge status={targetStatus} />
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {submission.registryName} · {collateralId}
            </p>

            {refLabel && (
              <div className="mb-3">
                <label className="block text-xs font-600 text-foreground mb-1">{refLabel}</label>
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="e.g. BRELA/2026/00123"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {targetStatus === 'Rejected' && (
              <div className="mb-3">
                <label className="block text-xs font-600 text-foreground mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectionInput}
                  onChange={(e) => setRejectionInput(e.target.value)}
                  rows={2}
                  placeholder="Describe why the submission was rejected…"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-600 text-foreground mb-1">Notes (optional)</label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                rows={2}
                placeholder="Any additional notes for the audit trail…"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={saving || (targetStatus === 'Rejected' && !rejectionInput.trim())}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Submission Form ──────────────────────────────────────────────────────

interface NewSubmissionFormProps {
  collateralRecordId: string;
  existingRegistries: PerfectionRegistryName[];
  onCreated: () => void;
  onCancel: () => void;
  userId?: string;
  userName?: string;
}

function NewSubmissionForm({ collateralRecordId, existingRegistries, onCreated, onCancel, userId, userName }: NewSubmissionFormProps) {
  const [registry, setRegistry] = useState<PerfectionRegistryName>('BRELA');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await registrySubmissionTrackerService.create({
        collateralRecordId,
        registryName: registry,
        notes: notes || undefined,
        createdBy: userId,
        createdByName: userName,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create submission');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-primary/30 shadow-sm p-5">
      <h3 className="text-sm font-700 text-foreground mb-4">New Registry Submission</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-600 text-foreground mb-1">Registry <span className="text-red-500">*</span></label>
          <select
            value={registry}
            onChange={(e) => setRegistry(e.target.value as PerfectionRegistryName)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          >
            {REGISTRY_NAMES.map((r) => (
              <option key={r} value={r}>{r} — {REGISTRY_DESCRIPTIONS[r]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />}
          Create Submission
        </button>
      </div>
    </form>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

export default function RegistrySubmissionsTab({ collateral }: Props) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<RegistrySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    if (!collateral.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await registrySubmissionTrackerService.listByCollateral(collateral.id);
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [collateral.id]);

  const userName = (user as any)?.user_metadata?.full_name ?? user?.email ?? 'Unknown';

  // Summary counts
  const counts = {
    total: submissions.length,
    registered: submissions.filter((s) => s.submissionStatus === 'Registered').length,
    pending: submissions.filter((s) => s.submissionStatus === 'Pending').length,
    rejected: submissions.filter((s) => s.submissionStatus === 'Rejected').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Registry Submissions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track perfection submissions across all applicable registries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> New Submission
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: counts.total, color: 'text-foreground', bg: 'bg-muted/30' },
            { label: 'Registered', value: counts.registered, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'In Progress', value: counts.total - counts.registered - counts.rejected, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Rejected', value: counts.rejected, color: 'text-red-700', bg: 'bg-red-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`p-3 rounded-xl border border-border ${kpi.bg}`}>
              <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-xl font-800 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* New Submission Form */}
      {showForm && (
        <NewSubmissionForm
          collateralRecordId={collateral.id}
          existingRegistries={submissions.map((s) => s.registryName)}
          onCreated={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
          userId={user?.id}
          userName={userName}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading submissions…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={14} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && submissions.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText size={20} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-600 text-foreground">No registry submissions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a submission to start tracking perfection across BRELA, Lands Registry, TRA, DSE/CSDR, or Tanzania Shipping.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Create First Submission
          </button>
        </div>
      )}

      {/* Submission Cards */}
      {!loading && !error && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <SubmissionCard
              key={sub.id}
              submission={sub}
              collateralId={collateral.collateralId}
              onRefresh={load}
              userId={user?.id}
              userName={userName}
            />
          ))}
        </div>
      )}

      {/* Perfection completion notice */}
      {counts.registered > 0 && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-600 text-green-800">
              {counts.registered} of {counts.total} submission{counts.total !== 1 ? 's' : ''} reached Registered status
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Verify the Perfection Workflow is updated to reflect completed registrations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
