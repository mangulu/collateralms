'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, Plus, RefreshCw, Eye, X, Loader2, ChevronRight, LayoutGrid, XCircle, CheckSquare, Square, Layers, FileText, Download, ExternalLink, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import ActionHelpIcon from '@/components/ui/ActionHelpIcon';
import {
  listValuations,
  createValuation,
  recordValuationResult,
  approveValuation,
  rejectValuation,
  getValuationStats,
  type CollateralValuation,
  type ValuationStatus,
} from '@/lib/supabase/valuationService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerOverdueActionSms } from '@/lib/supabase/smsNotificationRulesService';
import { workflowLookupsService, type CollateralOption } from '@/lib/supabase/workflowLookupsService';
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';
import { CollateralDocument } from '@/lib/supabase/documentService';
import { createClient } from '@/lib/supabase/client';


const STATUS_COLORS: Record<ValuationStatus, { text: string; bg: string; border: string }> = {
  Scheduled:    { text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'In Progress':{ text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  Completed:    { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  Approved:     { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  Rejected:     { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  Overdue:      { text: 'text-red-800',    bg: 'bg-red-100',   border: 'border-red-300' },
};

const VALUATION_TYPES = ['Full Valuation', 'Desk Review', 'Drive-By Inspection', 'Insurance Valuation', 'Forced Sale Valuation'];
const VALUATION_METHODS = ['Market Value', 'Income Approach', 'Cost Approach', 'Forced Sale Value', 'Replacement Cost'];

function formatCurrency(val: number | null): string {
  if (val == null) return '—';
  return 'TZS ' + val.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function agingDays(scheduledDate: string): number {
  return Math.ceil((new Date().getTime() - new Date(scheduledDate).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Inline Document Viewer ───────────────────────────────────────────────────

function InlineDocViewer({ signedUrl, fileName, mimeType }: { signedUrl: string; fileName: string; mimeType?: string }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType?.includes('pdf');
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-gray-50 ${fullscreen ? 'fixed inset-0 z-[80] flex flex-col bg-white rounded-none border-0' : ''}`}>
      {/* Toolbar */}
      <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white ${fullscreen ? 'shrink-0' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="text-blue-600 shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate max-w-[200px]">{fileName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            {isPdf ? 'PDF' : isImage ? 'Image' : 'Document'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors" title="Open in new tab">
            <ExternalLink size={13} />
          </a>
          <a href={signedUrl} download={fileName} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Download">
            <Download size={13} />
          </a>
          <button onClick={() => setFullscreen(f => !f)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          {!fullscreen && (
            <button onClick={() => setCollapsed(c => !c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title={collapsed ? 'Show document' : 'Hide document'}>
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          )}
          {fullscreen && (
            <button onClick={() => setFullscreen(false)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors ml-1" title="Close">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {/* Body */}
      {(!collapsed || fullscreen) && (
        <div className={fullscreen ? 'flex-1 overflow-hidden' : 'h-[320px] overflow-hidden'}>
          {isPdf ? (
            <iframe src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1`} className="w-full h-full border-0" title={fileName} />
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-auto p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded" />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-50 p-6">
              <FileText size={36} className="text-gray-300" />
              <p className="text-sm text-gray-500 text-center">This file type cannot be previewed inline.</p>
              <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                <ExternalLink size={13} /> Open Document
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Valuation Documents Section ─────────────────────────────────────────────

const VALUATION_DOC_TYPES = ['Valuation Report', 'Valuation / Survey Report', 'Appraisal', 'Insurance Certificate', 'Insurance Policy', 'Other'];

function ValuationDocumentsSection({ collateralId }: { collateralId: string }) {
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocIdx, setActiveDocIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchDocs() {
      setLoading(true);
      try {
        const supabase = createClient();
        // Query by collateral_id string ref
        const { data, error } = await supabase
          .from('collateral_documents')
          .select('*')
          .eq('collateral_id', collateralId)
          .order('created_at', { ascending: false });

        if (error || !data) { if (!cancelled) setDocs([]); return; }

        const mapped = data.map((row: any): CollateralDocument => ({
          id: row.id,
          collateralRecordId: row.collateral_record_id,
          collateralId: row.collateral_id,
          fileName: row.file_name,
          filePath: row.file_path,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          documentType: row.document_type,
          version: row.version,
          notes: row.notes ?? '',
          uploadedBy: row.uploaded_by,
          uploadedByName: row.uploaded_by_name ?? '',
          createdAt: row.created_at,
          workflowStage: row.workflow_stage ?? undefined,
          isRollback: row.is_rollback ?? false,
          rolledBackFromVersion: row.rolled_back_from_version ?? null,
          rolledBackByName: row.rolled_back_by_name ?? null,
          rolledBackAt: row.rolled_back_at ?? null,
        }));

        // Generate signed URLs
        const withUrls = await Promise.all(
          mapped.map(async (doc) => {
            try {
              const { data: urlData } = await supabase.storage
                .from('collateral-documents')
                .createSignedUrl(doc.filePath, 3600);
              return { ...doc, signedUrl: urlData?.signedUrl };
            } catch { return doc; }
          })
        );

        if (!cancelled) {
          // Prioritise valuation-related doc types first
          const sorted = [...withUrls].sort((a, b) => {
            const aIsVal = VALUATION_DOC_TYPES.includes(a.documentType);
            const bIsVal = VALUATION_DOC_TYPES.includes(b.documentType);
            if (aIsVal && !bIsVal) return -1;
            if (!aIsVal && bIsVal) return 1;
            return 0;
          });
          setDocs(sorted);
          setActiveDocIdx(0);
        }
      } catch { if (!cancelled) setDocs([]); }
      finally { if (!cancelled) setLoading(false); }
    }
    fetchDocs();
    return () => { cancelled = true; };
  }, [collateralId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" /> Loading documents…
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
        <FileText size={24} className="text-gray-300" />
        <p className="text-xs text-gray-400">No supporting documents uploaded for this collateral.</p>
      </div>
    );
  }

  const activeDoc = docs[activeDocIdx];

  return (
    <div className="space-y-3">
      {/* Document selector tabs (if multiple) */}
      {docs.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {docs.map((doc, idx) => (
            <button
              key={doc.id}
              onClick={() => setActiveDocIdx(idx)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors truncate max-w-[160px] ${
                idx === activeDocIdx
                  ? 'bg-blue-600 text-white border-blue-600' :'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title={doc.fileName}
            >
              <FileText size={11} className="shrink-0" />
              <span className="truncate">{doc.documentType}</span>
            </button>
          ))}
        </div>
      )}
      {/* Inline viewer */}
      {activeDoc.signedUrl ? (
        <InlineDocViewer
          signedUrl={activeDoc.signedUrl}
          fileName={activeDoc.fileName}
          mimeType={activeDoc.mimeType}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileText size={24} className="text-gray-300" />
          <p className="text-xs text-gray-400">Document URL unavailable — storage access may be restricted.</p>
        </div>
      )}
      <p className="text-[10px] text-gray-400">
        {docs.length} document{docs.length !== 1 ? 's' : ''} attached · Showing: <span className="font-medium text-gray-600">{activeDoc.documentType}</span> · v{activeDoc.version}
      </p>
    </div>
  );
}

// ─── Action Dialog ─────────────────────────────────────────────────────────────

type ValuationActionType = 'record' | 'approve' | 'reject';

interface ValuationActionDialogProps {
  open: boolean;
  valuation: CollateralValuation | null;
  action: ValuationActionType | null;
  onClose: () => void;
  onRecord: (form: { completedDate: string; valuationAmount: string; reportReference: string; notes: string }) => Promise<void>;
  onApprove: (v: CollateralValuation) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  loading: boolean;
}

function ValuationActionDialog({ open, valuation, action, onClose, onRecord, onApprove, onReject, loading }: ValuationActionDialogProps) {
  const [recordForm, setRecordForm] = useState({ completedDate: new Date().toISOString().split('T')[0], valuationAmount: '', reportReference: '', notes: '' });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (open) {
      setRecordForm({ completedDate: new Date().toISOString().split('T')[0], valuationAmount: '', reportReference: '', notes: '' });
      setRejectReason('');
    }
  }, [open]);

  if (!open || !valuation || !action) return null;

  const titles: Record<ValuationActionType, string> = {
    record: 'Record Valuation Result',
    approve: 'Approve Valuation',
    reject: 'Reject Valuation',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{titles[action]}</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{valuation.collateralDescription ?? valuation.collateralId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {action === 'record' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completed Date *</label>
                  <input
                    type="date"
                    value={recordForm.completedDate}
                    onChange={(e) => setRecordForm((f) => ({ ...f, completedDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Amount (TZS) *</label>
                  <input
                    type="number"
                    value={recordForm.valuationAmount}
                    onChange={(e) => setRecordForm((f) => ({ ...f, valuationAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Reference</label>
                <input
                  type="text"
                  value={recordForm.reportReference}
                  onChange={(e) => setRecordForm((f) => ({ ...f, reportReference: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onRecord(recordForm)}
                disabled={loading || !recordForm.valuationAmount}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#003c5a' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Saving…' : 'Save Result'}
              </button>
            </div>
          </>
        )}

        {action === 'approve' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Collateral</span>
                  <span className="font-medium text-gray-800">{valuation.collateralDescription ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuation Amount</span>
                  <span className="font-medium text-gray-800">{formatCurrency(valuation.valuationAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuer</span>
                  <span className="font-medium text-gray-800">{valuation.valuerName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Report Ref</span>
                  <span className="font-medium text-gray-800">{valuation.reportReference ?? '—'}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">Approve this valuation result. It will be recorded in the collateral registry.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onApprove(valuation)}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Approving…' : 'Approve Valuation'}
              </button>
            </div>
          </>
        )}

        {action === 'reject' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">Reject this valuation result. Please provide a clear reason.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide reason for rejection…"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                    rejectReason.trim().length === 0
                      ? 'border-red-300 focus:ring-red-400/30 bg-red-50/30'
                      : rejectReason.trim().length < 10
                      ? 'border-amber-300 focus:ring-amber-400/30' :'border-gray-200 focus:ring-red-400'
                  }`}
                />
                {rejectReason.trim().length === 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
                    <AlertTriangle size={12} />
                    A rejection reason is required — explain why this valuation is being rejected.
                  </p>
                )}
                {rejectReason.trim().length > 0 && rejectReason.trim().length < 10 && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-1.5">
                    <AlertTriangle size={12} />
                    Please provide a more detailed reason (at least 10 characters).
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onReject(rejectReason)}
                disabled={loading || rejectReason.trim().length < 10}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Rejecting…' : 'Reject Valuation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Batch Action Panel ────────────────────────────────────────────────────────

type BatchValuationAction = 'approve' | 'reject';

interface BatchValuationPanelProps {
  selectedIds: Set<string>;
  selectedItems: CollateralValuation[];
  userId: string;
  userName: string;
  userRole: string;
  onClearSelection: () => void;
  onBatchComplete: () => void;
}

function BatchValuationPanel({ selectedIds, selectedItems, userId, userName, userRole, onClearSelection, onBatchComplete }: BatchValuationPanelProps) {
  const [batchAction, setBatchAction] = useState<BatchValuationAction | ''>('');
  const [batchNote, setBatchNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ id: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Only Completed valuations can be batch approved/rejected
  const eligibleItems = selectedItems.filter(v => v.valuationStatus === 'Completed');

  const availableActions: { value: BatchValuationAction; label: string; color: string; icon: React.ReactNode; requiresNote: boolean }[] = [
    { value: 'approve', label: 'Approve All', color: 'bg-green-600 hover:bg-green-700', icon: <CheckCircle2 size={14} />, requiresNote: false },
    { value: 'reject',  label: 'Reject All',  color: 'bg-red-600 hover:bg-red-700',    icon: <XCircle size={14} />,     requiresNote: true },
  ];

  const selectedActionConfig = availableActions.find(a => a.value === batchAction);

  async function handleBatchProcess() {
    if (!batchAction) return;
    if (selectedActionConfig?.requiresNote && !batchNote.trim()) return;
    if (eligibleItems.length === 0) return;

    setProcessing(true);
    setResults([]);

    const settled = await Promise.allSettled(
      eligibleItems.map(async (v) => {
        try {
          if (batchAction === 'approve') {
            await approveValuation(v.id, userId, userName, userRole);
          } else {
            await rejectValuation(v.id, batchNote, userId, userName, userRole);
          }
          return { id: v.id, success: true };
        } catch (err: any) {
          return { id: v.id, success: false, error: err.message || 'Failed' };
        }
      })
    );

    const resultList = settled.map((s, i) =>
      s.status === 'fulfilled' ? s.value : { id: eligibleItems[i].id, success: false, error: 'Unexpected error' }
    );

    setResults(resultList);
    setShowResults(true);
    setProcessing(false);

    onBatchComplete();

    const failCount = resultList.filter(r => !r.success).length;
    if (failCount === 0) {
      setTimeout(() => {
        onClearSelection();
        setBatchAction('');
        setBatchNote('');
        setShowResults(false);
        setResults([]);
      }, 1500);
    }
  }

  return (
    <div className="border-t-2 border-blue-500 bg-blue-50 px-4 py-3 shrink-0">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
            <Layers size={13} />
            {selectedIds.size} selected
          </div>
          <span className="text-xs text-gray-500">({eligibleItems.length} eligible for approval)</span>
          <button
            onClick={onClearSelection}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md hover:bg-white transition-colors bg-white"
          >
            <X size={11} /> Clear
          </button>
        </div>

        {eligibleItems.length > 0 ? (
          <div className="flex items-start gap-2 flex-1 flex-wrap">
            <select
              value={batchAction}
              onChange={(e) => { setBatchAction(e.target.value as BatchValuationAction | ''); setShowResults(false); }}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
            >
              <option value="">— Choose batch action —</option>
              {availableActions.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            {batchAction && (
              <div className="flex items-start gap-2 flex-1 flex-wrap">
                <textarea
                  value={batchNote}
                  onChange={(e) => setBatchNote(e.target.value)}
                  placeholder={
                    selectedActionConfig?.requiresNote
                      ? 'Shared rejection reason (required for all selected records)...'
                      : 'Shared note (optional)...'
                  }
                  rows={1}
                  className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  onClick={handleBatchProcess}
                  disabled={processing || (selectedActionConfig?.requiresNote && !batchNote.trim()) || eligibleItems.length === 0}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-md text-white disabled:opacity-50 transition-colors shrink-0 ${selectedActionConfig?.color ?? 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {processing ? (
                    <><Loader2 size={13} className="animate-spin" /> Processing {eligibleItems.length}...</>
                  ) : (
                    <>{selectedActionConfig?.icon} Apply to {eligibleItems.length} record{eligibleItems.length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-1.5">No eligible records selected (only &apos;Completed&apos; valuations can be batch approved/rejected).</p>
        )}

        {showResults && results.length > 0 && (
          <div className="w-full mt-2 space-y-1">
            {results.map(r => (
              <div key={r.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {r.success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {r.id}: {r.success ? 'Updated' : r.error}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ValuationDetailPanel({
  valuation,
  onClose,
  onOpenAction,
}: {
  valuation: CollateralValuation;
  onClose: () => void;
  onOpenAction: (action: ValuationActionType) => void;
}) {
  const sc = STATUS_COLORS[valuation.valuationStatus] ?? STATUS_COLORS['Scheduled'];
  const isOverdue = valuation.valuationStatus === 'Overdue';
  const canRecord = ['Scheduled', 'Overdue', 'In Progress'].includes(valuation.valuationStatus);
  const canApproveReject = valuation.valuationStatus === 'Completed';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                {valuation.valuationStatus}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle size={11} /> {agingDays(valuation.scheduledDate)}d overdue
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 truncate">{valuation.collateralDescription ?? '—'}</h2>
            <p className="text-sm text-gray-500">{valuation.collateralType} · {valuation.valuationType}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Supporting Documents — inline viewer */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Supporting Documents</h3>
          <ValuationDocumentsSection collateralId={valuation.collateralId} />
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valuation Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Scheduled Date', value: formatDate(valuation.scheduledDate) },
              { label: 'Valuation Method', value: valuation.valuationMethod },
              { label: 'Valuer Name', value: valuation.valuerName ?? '—' },
              { label: 'Valuer Firm', value: valuation.valuerFirm ?? '—' },
              { label: 'Completed Date', value: formatDate(valuation.completedDate) },
              { label: 'Report Reference', value: valuation.reportReference ?? '—' },
              { label: 'Valuation Amount', value: formatCurrency(valuation.valuationAmount) },
              { label: 'Approved At', value: formatDate(valuation.approvedAt) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {valuation.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">{valuation.notes}</div>
          </div>
        )}

        {valuation.rejectionReason && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rejection Reason</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">{valuation.rejectionReason}</div>
          </div>
        )}
      </div>

      {/* Action Zone */}
      {(canRecord || canApproveReject) && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
          <div className="flex items-center gap-2">
            {canRecord && (
              <button
                onClick={() => onOpenAction('record')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Record Result
              </button>
            )}
            {canApproveReject && (
              <>
                <button
                  onClick={() => onOpenAction('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Reject
                  <ActionHelpIcon text="Reject this valuation. You will be asked to provide a reason. The valuer will be notified and may need to resubmit." position="top" />
                </button>
                <button
                  onClick={() => onOpenAction('approve')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Approve
                  <ActionHelpIcon text="Approve this valuation result. The collateral value will be updated and the workflow will advance to the next stage." position="top" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function ValuationWorkflowContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [valuations, setValuations] = useState<CollateralValuation[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, overdue: 0, pendingApproval: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ValuationStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selectedValuation, setSelectedValuation] = useState<CollateralValuation | null>(null);
  const [valuationDrawerOpen, setValuationDrawerOpen] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  // Lookup data
  const [collateralOptions, setCollateralOptions] = useState<CollateralOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; valuation: CollateralValuation | null; action: ValuationActionType | null }>({ open: false, valuation: null, action: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectConfirm, setRejectConfirm] = useState<{ open: boolean; valuation: CollateralValuation | null }>({ open: false, valuation: null });

  // Schedule form
  const [scheduleForm, setScheduleForm] = useState({
    collateralId: '',
    valuationType: 'Full Valuation',
    scheduledDate: '',
    valuerName: '',
    valuerFirm: '',
    valuationMethod: 'Market Value',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        listValuations(filterStatus !== 'All' ? { status: filterStatus } : undefined),
        getValuationStats(),
      ]);
      setValuations(data);
      setStats(s);
      const overdueItems = data.filter((v) => v.valuationStatus === 'Overdue');
      overdueItems.forEach((v) => {
        triggerOverdueActionSms({
          actionType: 'Valuation',
          collateralId: v.collateralId,
          collateralDescription: v.collateralDescription,
          scheduledDate: v.scheduledDate,
          daysOverdue: agingDays(v.scheduledDate),
        });
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load valuations');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadLookups = useCallback(async () => {
    if (collateralOptions.length > 0) return;
    setLookupsLoading(true);
    try {
      const cols = await workflowLookupsService.getCollateralOptions();
      setCollateralOptions(cols);
    } catch { /* silent */ } finally {
      setLookupsLoading(false);
    }
  }, [collateralOptions.length]);

  useEffect(() => {
    const collateralId = searchParams.get('collateralId');
    if (collateralId) {
      setScheduleForm((f) => ({ ...f, collateralId }));
      setShowScheduleModal(true);
      loadLookups();
    }
  }, [searchParams, loadLookups]);

  const openScheduleModal = () => {
    setShowScheduleModal(true);
    loadLookups();
  };

  const handleSchedule = async () => {
    if (!scheduleForm.collateralId || !scheduleForm.scheduledDate) return;
    setActionLoading(true);
    try {
      await createValuation({ ...scheduleForm, createdBy: userProfile?.id });
      setShowScheduleModal(false);
      setScheduleForm({ collateralId: '', valuationType: 'Full Valuation', scheduledDate: '', valuerName: '', valuerFirm: '', valuationMethod: 'Market Value', notes: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecord = async (form: { completedDate: string; valuationAmount: string; reportReference: string; notes: string }) => {
    if (!actionDialog.valuation || !form.valuationAmount) return;
    setActionLoading(true);
    try {
      await recordValuationResult(actionDialog.valuation.id, {
        completedDate: form.completedDate,
        valuationAmount: parseFloat(form.valuationAmount),
        reportReference: form.reportReference,
        notes: form.notes,
      });
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (v: CollateralValuation) => {
    if (!userProfile?.id) return;
    setActionLoading(true);
    try {
      await approveValuation(
        v.id,
        userProfile.id,
        userProfile.full_name ?? undefined,
        userProfile.role ?? undefined,
      );
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!actionDialog.valuation || !reason) return;
    setActionLoading(true);
    try {
      await rejectValuation(
        actionDialog.valuation.id,
        reason,
        userProfile?.id ?? undefined,
        userProfile?.full_name ?? undefined,
        userProfile?.role ?? undefined,
      );
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const collateralSelectOptions: SelectOption[] = collateralOptions.map((c) => ({
    value: c.id,
    label: c.collateralId,
    sublabel: `${c.description} · ${c.type}`,
    badge: c.facilityId,
  }));

  const filtered = (filterStatus === 'All' ? valuations : valuations.filter((v) => v.valuationStatus === filterStatus))
    .filter((v) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (v.collateralDescription ?? '').toLowerCase().includes(s) ||
        v.collateralId.toLowerCase().includes(s) ||
        v.valuationType.toLowerCase().includes(s) ||
        (v.valuerName ?? '').toLowerCase().includes(s)
      );
    });

  // Batch helpers
  const allFilteredIds = filtered.map(v => v.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allFilteredIds));
  }

  function toggleSelectOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBatchMode(false);
  }

  const selectedBatchItems = filtered.filter(v => selectedIds.has(v.id));

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Valuation Workflow</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Valuation Workflow</h1>
              <p className="text-xs text-gray-500">Schedule, record, and approve collateral revaluations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!batchMode ? (
              <button
                onClick={() => { setBatchMode(true); setSelectedIds(new Set()); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Layers size={14} /> Batch Actions
              </button>
            ) : (
              <button
                onClick={clearSelection}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={14} /> Exit Batch Mode
              </button>
            )}
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={openScheduleModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#003c5a' }}
            >
              <Plus size={16} /> Schedule Valuation
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { key: 'All' as const,       label: 'Total',           value: stats.total,           icon: CalendarClock, color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
            { key: 'Scheduled' as const, label: 'Scheduled',       value: stats.scheduled,       icon: Clock,         color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { key: 'Overdue' as const,   label: 'Overdue',         value: stats.overdue,         icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
            { key: 'Completed' as const, label: 'Pending Approval',value: stats.pendingApproval, icon: Eye,           color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
            { key: 'Approved' as const,  label: 'Approved',        value: stats.approved,        icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
          ].map(({ key, label, value, icon: Icon, color, bg, border }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${bg} ${border} ${filterStatus === key ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={15} className={color} />
                <span className={`text-lg font-bold ${color}`}>{value}</span>
              </div>
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 shrink-0">{error}</div>
      )}

      {/* Body — full-width list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* List Panel */}
        <div className="flex flex-col w-full bg-white min-h-0">
          {/* Batch mode hint */}
          {batchMode && (
            <div className="mx-4 mt-3 mb-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center gap-3 shrink-0">
              <Layers size={15} className="text-blue-600 shrink-0" />
              <p className="text-sm text-blue-700 font-medium">
                Batch mode active — check boxes next to &apos;Completed&apos; valuations, then use the action bar below to approve or reject all at once.
              </p>
            </div>
          )}
          {/* Search + filter */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              {/* Select-all checkbox */}
              {batchMode && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0 px-1"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : someSelected ? (
                    <CheckSquare size={16} className="text-blue-400" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span className="text-xs">{allSelected ? 'Deselect all' : 'Select all'}</span>
                </button>
              )}
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by collateral, type, valuer…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'Scheduled', 'Overdue', 'In Progress', 'Completed', 'Approved', 'Rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filterStatus === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={filterStatus === s ? { backgroundColor: '#003c5a' } : {}}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Loading valuations…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <CalendarClock size={32} className="text-gray-300" />
                <p className="text-sm text-gray-500">No valuations found</p>
              </div>
            ) : (
              filtered.map((v) => {
                const sc = STATUS_COLORS[v.valuationStatus] ?? STATUS_COLORS['Scheduled'];
                const isDrawerSelected = selectedValuation?.id === v.id && valuationDrawerOpen;
                const isBatchSelected = selectedIds.has(v.id);
                const isOverdue = v.valuationStatus === 'Overdue';
                const canRecord = ['Scheduled', 'Overdue', 'In Progress'].includes(v.valuationStatus);
                const canApproveReject = v.valuationStatus === 'Completed';

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      if (batchMode) {
                        toggleSelectOne(v.id, { stopPropagation: () => {} } as React.MouseEvent);
                      } else {
                        setSelectedValuation(v);
                        setValuationDrawerOpen(true);
                      }
                    }}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      batchMode && isBatchSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : !batchMode && isDrawerSelected ?'bg-blue-50 border-l-2 border-l-blue-500': isOverdue ?'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox (batch mode) */}
                      {batchMode && (
                        <button
                          onClick={(e) => toggleSelectOne(v.id, e)}
                          className="mt-1 shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {isBatchSelected ? (
                            <CheckSquare size={18} className="text-blue-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{v.collateralDescription ?? '—'}</p>
                          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                            {v.valuationStatus}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-2">
                          <span>{v.valuationType}</span>
                          <span className="text-gray-300">·</span>
                          <span>{v.collateralType}</span>
                          {v.valuerName && <><span className="text-gray-300">·</span><span>{v.valuerName}</span></>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>Scheduled: {formatDate(v.scheduledDate)}</span>
                          {v.valuationAmount != null && <span className="ml-auto font-medium text-gray-700">{formatCurrency(v.valuationAmount)}</span>}
                          {isOverdue && <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle size={11} />{agingDays(v.scheduledDate)}d overdue</span>}
                        </div>
                        {/* Quick action buttons (only in non-batch mode) */}
                        {!batchMode && (canRecord || canApproveReject) && (
                          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            {canRecord && (
                              <button
                                onClick={() => { setSelectedValuation(v); setActionDialog({ open: true, valuation: v, action: 'record' }); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                              >
                                Record
                              </button>
                            )}
                            {canApproveReject && (
                              <>
                                <button
                                  onClick={() => { setSelectedValuation(v); setActionDialog({ open: true, valuation: v, action: 'approve' }); }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedValuation(v);
                                    setRejectConfirm({ open: true, valuation: v });
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Batch Action Panel */}
          {batchMode && selectedIds.size > 0 && (
            <BatchValuationPanel
              selectedIds={selectedIds}
              selectedItems={selectedBatchItems}
              userId={userProfile?.id ?? ''}
              userName={userProfile?.full_name ?? 'Reviewer'}
              userRole={userProfile?.role ?? 'Officer'}
              onClearSelection={clearSelection}
              onBatchComplete={load}
            />
          )}
        </div>
      </div>

      {/* Valuation Drawer */}
      <WorkflowDrawer
        open={valuationDrawerOpen}
        onClose={() => { setValuationDrawerOpen(false); setTimeout(() => setSelectedValuation(null), 300); }}
                width="w-[680px]"
        deadline={selectedValuation?.scheduledDate ?? undefined}
        overdueHours={
          selectedValuation?.valuationStatus === 'Overdue'
            ? Math.max(0, (Date.now() - new Date(selectedValuation.scheduledDate).getTime()) / (1000 * 60 * 60))
            : undefined
        }
      >
        {selectedValuation && (
          <ValuationDetailPanel
            valuation={selectedValuation}
            onClose={() => { setValuationDrawerOpen(false); setTimeout(() => setSelectedValuation(null), 300); }}
            onOpenAction={(action) => {
              if (action === 'reject') {
                setRejectConfirm({ open: true, valuation: selectedValuation });
              } else {
                setActionDialog({ open: true, valuation: selectedValuation, action });
              }
            }}
          />
        )}
      </WorkflowDrawer>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Valuation</h2>
            </div>
            <div className="p-6 space-y-4">
              <SearchableSelect
                label="Collateral *"
                required
                options={collateralSelectOptions}
                value={scheduleForm.collateralId}
                onChange={(v) => setScheduleForm((f) => ({ ...f, collateralId: v }))}
                placeholder="Select collateral…"
                loading={lookupsLoading}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Type</label>
                  <select value={scheduleForm.valuationType} onChange={(e) => setScheduleForm((f) => ({ ...f, valuationType: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                  <input type="date" value={scheduleForm.scheduledDate} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Name</label>
                  <input type="text" value={scheduleForm.valuerName} onChange={(e) => setScheduleForm((f) => ({ ...f, valuerName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Firm</label>
                  <input type="text" value={scheduleForm.valuerFirm} onChange={(e) => setScheduleForm((f) => ({ ...f, valuerFirm: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Method</label>
                <select value={scheduleForm.valuationMethod} onChange={(e) => setScheduleForm((f) => ({ ...f, valuationMethod: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSchedule}
                disabled={actionLoading || !scheduleForm.collateralId || !scheduleForm.scheduledDate}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {actionLoading ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      <ValuationActionDialog
        open={actionDialog.open}
        valuation={actionDialog.valuation}
        action={actionDialog.action}
        onClose={() => setActionDialog({ open: false, valuation: null, action: null })}
        onRecord={handleRecord}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={actionLoading}
      />

      {/* Reject Confirmation Modal */}
      {rejectConfirm.open && rejectConfirm.valuation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <XCircle size={22} className="text-red-500" />
                <h3 className="text-base font-semibold text-gray-900">Reject this Valuation?</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                You are about to reject the valuation for <span className="font-semibold">{rejectConfirm.valuation.collateralId}</span>. This action will be recorded and the valuer will be notified. Please provide a rejection reason on the next step.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setRejectConfirm({ open: false, valuation: null })}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const v = rejectConfirm.valuation!;
                  setRejectConfirm({ open: false, valuation: null });
                  setActionDialog({ open: true, valuation: v, action: 'reject' });
                }}
                className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
