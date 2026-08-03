'use client';
import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { collateralTypeRequiredDocsService, CollateralTypeRequiredDoc } from '@/lib/supabase/collateralTypeRequiredDocsService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedDoc {
  docType: string;
  fileName: string;
  status: string;
}

interface MandatoryDocumentsCardProps {
  collateral: CollateralRecord;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MandatoryDocumentsCard({ collateral }: MandatoryDocumentsCardProps) {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<CollateralTypeRequiredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!collateral.id || !collateral.type) return;

    const supabase = createClient();

    Promise.all([
      // Fetch configured required docs for this collateral type
      collateralTypeRequiredDocsService.getByType(collateral.type),
      // Fetch uploaded documents for this collateral record
      supabase
        .from('collateral_documents')
        .select('doc_type, file_name, status')
        .eq('collateral_record_id', collateral.id),
    ])
      .then(([reqDocs, supabaseResult]) => {
        const data = supabaseResult.data;
        setRequiredDocs(reqDocs);
        if (data) {
          setUploadedDocs(
            data.map((d: any) => ({
              docType: d.doc_type ?? '',
              fileName: d.file_name ?? '',
              status: d.status ?? 'uploaded',
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collateral.id, collateral.type]);

  // Only show mandatory docs in the checklist
  const mandatoryList = requiredDocs.filter((d) => d.isMandatory);

  if (!loading && mandatoryList.length === 0) return null;

  // Match uploaded docs to mandatory list (case-insensitive partial match)
  const docStatus = mandatoryList.map((req) => {
    const match = uploadedDocs.find(
      (u) =>
        u.docType.toLowerCase().includes(req.documentName.toLowerCase().split(' ')[0]) ||
        req.documentName.toLowerCase().includes(u.docType.toLowerCase().split(' ')[0])
    );
    return { required: req.documentName, uploaded: !!match, fileName: match?.fileName };
  });

  const uploadedCount = docStatus.filter((d) => d.uploaded).length;
  const totalCount = docStatus.length;
  const completionPct = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;
  const allComplete = totalCount > 0 && uploadedCount === totalCount;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText size={14} className="text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-700 text-foreground">Document Checklist</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Required for {collateral.type} · {loading ? '…' : `${uploadedCount}/${totalCount} uploaded`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span
              className={`text-xs font-700 px-2.5 py-1 rounded-full ${
                allComplete
                  ? 'bg-green-100 text-green-700'
                  : uploadedCount > 0
                  ? 'bg-amber-100 text-amber-700' :'bg-red-100 text-red-700'
              }`}
            >
              {completionPct}%
            </span>
          )}
          {expanded ? (
            <ChevronUp size={15} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={15} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {/* Progress bar */}
          {!loading && totalCount > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  allComplete ? 'bg-green-500' : uploadedCount > 0 ? 'bg-amber-500' : 'bg-red-400'
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Clock size={14} className="animate-spin" />
              Checking uploaded documents…
            </div>
          ) : mandatoryList.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No required documents configured for <strong>{collateral.type}</strong>. Admins can configure them in Settings → Collateral Types.
            </p>
          ) : (
            <ul className="space-y-2">
              {docStatus.map(({ required, uploaded, fileName }) => (
                <li
                  key={required}
                  className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                    uploaded
                      ? 'bg-green-50 border-green-200' :'bg-red-50/60 border-red-200/70'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {uploaded ? (
                      <CheckCircle2 size={15} className="text-green-600" />
                    ) : (
                      <AlertCircle size={15} className="text-red-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-600 ${
                        uploaded ? 'text-green-800' : 'text-red-700'
                      }`}
                    >
                      {required}
                    </p>
                    {uploaded && fileName && (
                      <p className="text-[10px] text-green-600 mt-0.5 truncate">{fileName}</p>
                    )}
                    {!uploaded && (
                      <p className="text-[10px] text-red-500 mt-0.5">Not yet uploaded</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!allComplete && !loading && mandatoryList.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              Upload missing documents using the <strong>Upload</strong> button in the Documents section below to complete the checklist for this {collateral.type}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
