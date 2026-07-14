'use client';
import React, { useState, useEffect } from 'react';
import { X, Download, RotateCcw, Clock, AlertCircle, RefreshCw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { documentService, CollateralDocument, DocumentVersionAudit } from '@/lib/supabase/documentService';

interface DocumentVersionHistoryModalProps {
  docs: CollateralDocument[];
  fileName: string;
  collateralRecordId: string;
  currentVersion: number;
  onClose: () => void;
  onDownload: (doc: CollateralDocument) => void;
  onRollbackComplete: () => void;
  userId: string;
  userName: string;
  canRollback?: boolean;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DocumentVersionHistoryModal({
  docs,
  fileName,
  collateralRecordId,
  currentVersion,
  onClose,
  onDownload,
  onRollbackComplete,
  userId,
  userName,
  canRollback = true,
}: DocumentVersionHistoryModalProps) {
  const [auditLog, setAuditLog] = useState<DocumentVersionAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<CollateralDocument | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState('');
  const [rollbackSuccess, setRollbackSuccess] = useState('');

  const sorted = [...(docs ?? [])].sort((a, b) => b.version - a.version);
  const latestVersion = sorted[0]?.version ?? currentVersion;

  const loadAudit = async () => {
    setAuditLoading(true);
    const entries = await documentService.getVersionAudit(collateralRecordId, fileName);
    setAuditLog(entries);
    setAuditLoading(false);
  };

  useEffect(() => {
    if (showAudit) loadAudit();
  }, [showAudit]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    setRollingBack(true);
    setRollbackError('');
    const result = await documentService.rollback(rollbackTarget, latestVersion, userId, userName);
    setRollingBack(false);
    if (result.error) {
      setRollbackError(result.error);
      return;
    }
    setRollbackSuccess(`Successfully restored v${rollbackTarget.version} as v${latestVersion + 1}`);
    setRollbackTarget(null);
    setTimeout(() => {
      onRollbackComplete();
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Version History</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[360px]">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Success banner */}
        {rollbackSuccess && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 shrink-0">
            <ShieldCheck size={16} className="shrink-0" />
            {rollbackSuccess}
          </div>
        )}

        {/* Rollback confirm panel */}
        {rollbackTarget && !rollbackSuccess && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shrink-0">
            <p className="text-sm font-medium text-amber-800 mb-1">Confirm Rollback</p>
            <p className="text-xs text-amber-700 mb-3">
              This will create <strong>v{latestVersion + 1}</strong> using the file from{' '}
              <strong>v{rollbackTarget.version}</strong> (uploaded {formatDateTime(rollbackTarget.createdAt)} by{' '}
              {rollbackTarget.uploadedByName || 'Unknown'}). The current version is preserved in history.
            </p>
            {rollbackError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1.5 mb-2">
                <AlertCircle size={13} /> {rollbackError}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setRollbackTarget(null); setRollbackError(''); }}
                disabled={rollingBack}
                className="px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={rollingBack}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {rollingBack ? <RefreshCw size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                {rollingBack ? 'Restoring…' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2.5">
          {sorted.map((doc, idx) => {
            const isLatest = idx === 0;
            const isRollbackEntry = doc.isRollback;
            return (
              <div
                key={doc.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isLatest
                    ? 'border-primary/30 bg-primary/5' :'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                {/* Version badge */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isLatest ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  v{doc.version}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{formatDateTime(doc.createdAt)}</span>
                    {isLatest && (
                      <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                    {isRollbackEntry && (
                      <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <RotateCcw size={9} /> Restored from v{doc.rolledBackFromVersion}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    By <span className="font-medium text-foreground">{doc.uploadedByName || 'Unknown'}</span>
                    {' · '}{documentService.formatFileSize(doc.fileSize)}
                  </p>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic truncate max-w-[280px]" title={doc.notes}>
                      "{doc.notes}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {doc.signedUrl && (
                    <button
                      onClick={() => onDownload(doc)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Download this version"
                    >
                      <Download size={14} className="text-muted-foreground" />
                    </button>
                  )}
                  {canRollback && !isLatest && !rollbackTarget && !rollbackSuccess && (
                    <button
                      onClick={() => setRollbackTarget(doc)}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                      title={`Restore v${doc.version} as new current version`}
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Audit log toggle */}
        <div className="border-t border-border shrink-0">
          <button
            onClick={() => setShowAudit((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Clock size={13} />
              Audit Trail
            </span>
            {showAudit ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAudit && (
            <div className="px-6 pb-4 max-h-[200px] overflow-y-auto space-y-2">
              {auditLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <RefreshCw size={12} className="animate-spin" /> Loading audit trail…
                </div>
              ) : auditLog.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No audit entries found.</p>
              ) : (
                auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      entry.action === 'rollback' ? 'bg-amber-100' : entry.action === 'delete' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      {entry.action === 'rollback' ? (
                        <RotateCcw size={10} className="text-amber-600" />
                      ) : entry.action === 'delete' ? (
                        <X size={10} className="text-red-600" />
                      ) : (
                        <Clock size={10} className="text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        <span className="font-medium capitalize">{entry.action}</span>
                        {entry.action === 'rollback' && entry.fromVersion && (
                          <span className="text-muted-foreground"> v{entry.fromVersion} → v{entry.toVersion}</span>
                        )}
                        {entry.action === 'upload' && (
                          <span className="text-muted-foreground"> v{entry.toVersion}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {entry.performedByName || 'Unknown'} · {formatDateTime(entry.performedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
