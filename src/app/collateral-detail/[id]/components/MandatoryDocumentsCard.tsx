'use client';
import React, { useEffect, useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CollateralRecord } from '@/lib/supabase/collateralService';

// ─── Mandatory document definitions per collateral type ───────────────────────

const MANDATORY_DOCS: Record<string, string[]> = {
  Mortgage: [
    'Title Deed (Original)',
    'Valuation Report (Certified)',
    'Land Rent Clearance Certificate',
    'Mortgage Deed / Charge Instrument',
    'Lands Registry Search Certificate',
    'Survey Plan / Plot Map',
    'Building Permit (if applicable)',
  ],
  Debenture: [
    'Debenture Deed (Executed)',
    'Certificate of Incorporation',
    'Board Resolution (Authorising Charge)',
    'BRELA Registration Certificate',
    'Memorandum & Articles of Association',
    'Audited Financial Statements (Latest)',
    'Asset Schedule / Inventory List',
  ],
  'Motor Vehicle': [
    'Vehicle Registration Certificate (Original)',
    'Logbook (Original)',
    'TRA Encumbrance Search Certificate',
    'Comprehensive Insurance Policy',
    'Valuation Report',
    'Hire Purchase / Charge Agreement',
  ],
  'Shares (DSE)': [
    'Share Certificate(s) (Original)',
    'DSE Pledge Confirmation Letter',
    'CDS Account Statement',
    'Board Resolution (Authorising Pledge)',
    'Share Transfer Form (Blank, Signed)',
    'DSE Registry Search',
  ],
  FDR: [
    'Fixed Deposit Receipt (Original)',
    'Bank Lien Letter / Pledge Confirmation',
    'Account Statement',
    'Deed of Assignment',
  ],
  Guarantee: [
    'Guarantee Deed (Executed)',
    'Guarantor Financial Statements',
    'Board Resolution (if Corporate Guarantor)',
    'Certificate of Incorporation (if Corporate)',
    'Guarantor ID / KYC Documents',
  ],
  'Ship/Vessel': [
    'Ship Registration Certificate (TASAC)',
    'Mortgage of Ship Deed',
    'TASAC Encumbrance Search',
    'Hull & Machinery Insurance Policy',
    'Valuation / Survey Report',
    'Classification Society Certificate',
    'Crew & Manning Certificate',
  ],
};

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
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const mandatoryList = MANDATORY_DOCS[collateral.type] ?? [];

  useEffect(() => {
    if (!collateral.id) return;
    const supabase = createClient();
    supabase
      .from('collateral_documents')
      .select('doc_type, file_name, status')
      .eq('collateral_record_id', collateral.id)
      .then(({ data }) => {
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
  }, [collateral.id]);

  if (mandatoryList.length === 0) return null;

  // Match uploaded docs to mandatory list (case-insensitive partial match)
  const docStatus = mandatoryList.map((required) => {
    const match = uploadedDocs.find(
      (u) =>
        u.docType.toLowerCase().includes(required.toLowerCase().split(' ')[0]) ||
        required.toLowerCase().includes(u.docType.toLowerCase().split(' ')[0])
    );
    return { required, uploaded: !!match, fileName: match?.fileName };
  });

  const uploadedCount = docStatus.filter((d) => d.uploaded).length;
  const totalCount = docStatus.length;
  const completionPct = Math.round((uploadedCount / totalCount) * 100);
  const allComplete = uploadedCount === totalCount;

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
            <h3 className="text-sm font-700 text-foreground">Required Documents</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {collateral.type} · {uploadedCount}/{totalCount} uploaded
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pill */}
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
          <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                allComplete ? 'bg-green-500' : uploadedCount > 0 ? 'bg-amber-500' : 'bg-red-400'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Clock size={14} className="animate-spin" />
              Checking uploaded documents…
            </div>
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

          {!allComplete && !loading && (
            <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
              Upload missing documents in the <strong>Documents &amp; History</strong> tab to complete the document checklist for this {collateral.type}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
