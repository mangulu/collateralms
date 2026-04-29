'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, RefreshCw, ArrowRight, Info, Eye, Send, AlertCircle, FileText } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type RowStatus = 'valid' | 'error' | 'warning' | 'duplicate';

interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Partial<CollateralUploadRecord>;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  duplicateOf?: string;
}

interface CollateralUploadRecord {
  collateral_id: string;
  obligor: string;
  obligor_id: string;
  type: string;
  description: string;
  value_tzs: number;
  facility_id: string;
  registry: string;
  registration_date: string;
  perfection_deadline: string;
  assigned_officer: string;
}

type UploadStep = 'upload' | 'preview' | 'committing' | 'done';

interface UploadSummary {
  total: number;
  valid: number;
  errors: number;
  warnings: number;
  duplicates: number;
  committed: number;
  failed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = [
  'collateral_id', 'obligor', 'obligor_id', 'type', 'description',
  'value_tzs', 'facility_id', 'registry',
];

const OPTIONAL_COLUMNS = [
  'registration_date', 'perfection_deadline', 'assigned_officer',
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const VALID_TYPES = ['Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel'];
const VALID_REGISTRIES = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];

const TEMPLATE_ROWS = [
  'collateral_id,obligor,obligor_id,type,description,value_tzs,facility_id,registry,registration_date,perfection_deadline,assigned_officer',
  'COL-2026-001,Coastal Traders Co.,OBL-2024-0441,Mortgage,"Plot 245 Block D Kinondoni",780000000,TZ-FAC-2025-0441,Lands Registry,2026-04-01,2026-06-01,J. Kamau',
  'COL-2026-002,Arusha Coffee Growers,OBL-2023-0812,FDR,"Fixed Deposit Receipt EXIM Bank",420000000,TZ-FAC-2025-0388,N/A,2026-04-10,,S. Ndege',
];

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

// ─── Validator ────────────────────────────────────────────────────────────────

function validateRow(raw: Record<string, string>, rowIndex: number, seenIds: Set<string>): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mapped: Partial<CollateralUploadRecord> = {};

  // Required fields
  for (const col of REQUIRED_COLUMNS) {
    if (!raw[col] || raw[col].trim() === '') {
      errors.push(`Missing required field: ${col}`);
    }
  }

  // collateral_id
  const cid = raw['collateral_id']?.trim();
  if (cid) {
    mapped.collateral_id = cid;
    if (!/^[A-Z0-9\-]+$/i.test(cid)) warnings.push('collateral_id contains unusual characters');
  }

  // obligor
  if (raw['obligor']?.trim()) mapped.obligor = raw['obligor'].trim();

  // obligor_id
  if (raw['obligor_id']?.trim()) mapped.obligor_id = raw['obligor_id'].trim();

  // type
  const type = raw['type']?.trim();
  if (type) {
    if (!VALID_TYPES.includes(type)) {
      errors.push(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
    } else {
      mapped.type = type;
    }
  }

  // description
  if (raw['description']?.trim()) {
    mapped.description = raw['description'].trim();
    if (mapped.description.length < 5) warnings.push('Description is very short');
  }

  // value_tzs
  const valStr = raw['value_tzs']?.trim().replace(/,/g, '');
  if (valStr) {
    const val = parseFloat(valStr);
    if (isNaN(val) || val <= 0) {
      errors.push('value_tzs must be a positive number');
    } else {
      mapped.value_tzs = val;
      if (val < 1000000) warnings.push('value_tzs is unusually low (< 1,000,000 TZS)');
    }
  }

  // facility_id
  if (raw['facility_id']?.trim()) mapped.facility_id = raw['facility_id'].trim();

  // registry
  const registry = raw['registry']?.trim();
  if (registry) {
    if (!VALID_REGISTRIES.includes(registry)) {
      errors.push(`Invalid registry "${registry}". Must be one of: ${VALID_REGISTRIES.join(', ')}`);
    } else {
      mapped.registry = registry;
    }
  }

  // dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const regDate = raw['registration_date']?.trim();
  if (regDate) {
    if (!dateRegex.test(regDate)) errors.push('registration_date must be YYYY-MM-DD');
    else mapped.registration_date = regDate;
  }
  const perfDate = raw['perfection_deadline']?.trim();
  if (perfDate) {
    if (!dateRegex.test(perfDate)) errors.push('perfection_deadline must be YYYY-MM-DD');
    else mapped.perfection_deadline = perfDate;
  }

  // assigned_officer
  if (raw['assigned_officer']?.trim()) mapped.assigned_officer = raw['assigned_officer'].trim();

  // duplicate detection
  let isDuplicate = false;
  let duplicateOf: string | undefined;
  if (cid) {
    if (seenIds.has(cid.toLowerCase())) {
      isDuplicate = true;
      duplicateOf = cid;
      errors.push(`Duplicate collateral_id "${cid}" found in this file`);
    } else {
      seenIds.add(cid.toLowerCase());
    }
  }

  const status: RowStatus = errors.length > 0
    ? (isDuplicate ? 'duplicate' : 'error')
    : warnings.length > 0 ? 'warning' : 'valid';

  return { rowIndex, raw, mapped, status, errors, warnings, isDuplicate, duplicateOf };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkUploadContent() {
  const { hasPermission } = usePermissions();
  const { user } = useAuth();

  const [step, setStep] = useState<UploadStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | RowStatus>('all');
  const [commitProgress, setCommitProgress] = useState<Record<number, 'pending' | 'committing' | 'done' | 'failed'>>({});
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [dbDuplicateChecked, setDbDuplicateChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!hasPermission(PERMISSIONS.COLLATERAL_EDIT)) {
    return <AccessDenied />;
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setFileError('');
    setMissingColumns([]);
    setParsedRows([]);
    setDbDuplicateChecked(false);

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!isCSV && !isExcel) {
      setFileError('Only CSV and Excel (.xlsx, .xls) files are supported.');
      return;
    }

    if (isExcel) {
      setFileError('Excel files detected. Please save as CSV (UTF-8) and re-upload. Excel parsing requires a server-side library not yet configured.');
      return;
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (headers.length === 0 || rows.length === 0) {
      setFileError('File appears empty or has no data rows.');
      return;
    }

    const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length > 0) {
      setMissingColumns(missing);
      setFileError(`Missing required columns: ${missing.join(', ')}`);
      return;
    }

    setFileName(file.name);

    // Parse & validate
    const seenIds = new Set<string>();
    const parsed = rows.map((raw, i) => validateRow(raw, i + 2, seenIds)); // row 1 = header

    // Check DB for existing collateral_ids
    const supabase = createClient();
    const ids = parsed.map(r => r.mapped.collateral_id).filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data } = await supabase
        .from('collateral_records')
        .select('collateral_id')
        .in('collateral_id', ids);
      const dbIds = new Set((data ?? []).map((r: any) => r.collateral_id?.toLowerCase()));
      setExistingIds(dbIds);

      // Mark DB duplicates
      parsed.forEach(row => {
        if (row.mapped.collateral_id && dbIds.has(row.mapped.collateral_id.toLowerCase())) {
          row.isDuplicate = true;
          row.duplicateOf = row.mapped.collateral_id;
          if (!row.errors.some(e => e.includes('already exists'))) {
            row.errors.push(`collateral_id "${row.mapped.collateral_id}" already exists in the database`);
          }
          row.status = 'duplicate';
        }
      });
    }
    setDbDuplicateChecked(true);
    setParsedRows(parsed);
    setStep('preview');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const toggleRow = (idx: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_ROWS.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'collateral_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommit = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid' || r.status === 'warning');
    if (validRows.length === 0) return;

    setStep('committing');
    const progress: Record<number, 'pending' | 'committing' | 'done' | 'failed'> = {};
    validRows.forEach(r => { progress[r.rowIndex] = 'pending'; });
    setCommitProgress({ ...progress });

    const supabase = createClient();
    let committed = 0;
    let failed = 0;

    for (const row of validRows) {
      setCommitProgress(prev => ({ ...prev, [row.rowIndex]: 'committing' }));
      try {
        const payload = {
          collateral_id: row.mapped.collateral_id,
          obligor: row.mapped.obligor,
          obligor_id: row.mapped.obligor_id,
          type: row.mapped.type,
          description: row.mapped.description,
          value_t_sh: row.mapped.value_tzs?.toString() ?? '0',
          facility_id: row.mapped.facility_id,
          status: 'Draft',
          registry: row.mapped.registry,
          registration_date: row.mapped.registration_date || null,
          perfection_deadline: row.mapped.perfection_deadline || null,
          assigned_officer: row.mapped.assigned_officer || null,
          requires_perfection: row.mapped.registry !== 'N/A',
          created_by: user?.id ?? null,
        };
        const { error } = await supabase.from('collateral_records').insert(payload);
        if (error) throw error;
        setCommitProgress(prev => ({ ...prev, [row.rowIndex]: 'done' }));
        committed++;
      } catch {
        setCommitProgress(prev => ({ ...prev, [row.rowIndex]: 'failed' }));
        failed++;
      }
      // small delay for UX
      await new Promise(res => setTimeout(res, 80));
    }

    setSummary({
      total: parsedRows.length,
      valid: parsedRows.filter(r => r.status === 'valid').length,
      errors: parsedRows.filter(r => r.status === 'error').length,
      warnings: parsedRows.filter(r => r.status === 'warning').length,
      duplicates: parsedRows.filter(r => r.status === 'duplicate').length,
      committed,
      failed,
    });
    setStep('done');
  };

  const reset = () => {
    setStep('upload');
    setFileName('');
    setFileError('');
    setParsedRows([]);
    setMissingColumns([]);
    setExpandedRows(new Set());
    setFilterStatus('all');
    setCommitProgress({});
    setSummary(null);
    setExistingIds(new Set());
    setDbDuplicateChecked(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const warnCount = parsedRows.filter(r => r.status === 'warning').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;
  const dupCount = parsedRows.filter(r => r.status === 'duplicate').length;
  const commitableCount = validCount + warnCount;

  const filteredRows = filterStatus === 'all' ? parsedRows : parsedRows.filter(r => r.status === filterStatus);

  const statusBadge = (status: RowStatus) => {
    const map: Record<RowStatus, { label: string; cls: string }> = {
      valid: { label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
      warning: { label: 'Warning', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
      error: { label: 'Error', cls: 'bg-red-50 text-red-700 border border-red-200' },
      duplicate: { label: 'Duplicate', cls: 'bg-purple-50 text-purple-700 border border-purple-200' },
    };
    const { label, cls } = map[status];
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
  };

  const commitStatusIcon = (s: 'pending' | 'committing' | 'done' | 'failed') => {
    if (s === 'committing') return <RefreshCw size={14} className="animate-spin text-primary" />;
    if (s === 'done') return <CheckCircle2 size={14} className="text-emerald-600" />;
    if (s === 'failed') return <XCircle size={14} className="text-red-500" />;
    return <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-700 text-foreground tracking-tight">Bulk Upload Collateral</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import collateral records from CSV. Validation and duplicate detection run before commit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-foreground/80"
          >
            <Download size={14} />
            Download Template
          </button>
          {step !== 'upload' && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors text-foreground/80"
            >
              <RefreshCw size={14} />
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {(['upload', 'preview', 'committing', 'done'] as UploadStep[]).map((s, i) => {
          const labels: Record<UploadStep, string> = { upload: 'Upload File', preview: 'Review & Validate', committing: 'Committing', done: 'Complete' };
          const stepOrder: UploadStep[] = ['upload', 'preview', 'committing', 'done'];
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx = stepOrder.indexOf(s);
          const isActive = step === s;
          const isDone = currentIdx > thisIdx;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive ? 'bg-primary text-white' : isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {isDone ? <CheckCircle2 size={12} /> : <span className="w-4 h-4 flex items-center justify-center rounded-full border border-current text-[10px]">{i + 1}</span>}
                {labels[s]}
              </div>
              {i < 3 && <div className="w-6 h-px bg-border mx-1" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP: Upload ── */}
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/3'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-primary/10' : 'bg-white border border-border'}`}>
              <Upload size={28} className={isDragging ? 'text-primary' : 'text-muted-foreground'} />
            </div>
            <div className="text-center">
              <p className="text-base font-600 text-foreground">Drop your CSV file here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse — CSV files supported</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>

          {fileError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-600">{fileError}</p>
                {missingColumns.length > 0 && (
                  <p className="mt-1 text-red-600">Missing: {missingColumns.join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Column Reference */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={15} className="text-primary" />
              <p className="text-sm font-600 text-foreground">Expected CSV Columns</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              <div>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-1.5">Required</p>
                {REQUIRED_COLUMNS.map(c => (
                  <div key={c} className="flex items-center gap-1.5 text-xs text-foreground/80 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <code className="font-mono">{c}</code>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-1.5">Optional</p>
                {OPTIONAL_COLUMNS.map(c => (
                  <div key={c} className="flex items-center gap-1.5 text-xs text-foreground/80 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <code className="font-mono">{c}</code>
                  </div>
                ))}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground"><span className="font-600">type</span> values: {VALID_TYPES.join(', ')}</p>
                  <p className="text-xs text-muted-foreground mt-1"><span className="font-600">registry</span> values: {VALID_REGISTRIES.join(', ')}</p>
                  <p className="text-xs text-muted-foreground mt-1"><span className="font-600">dates</span> format: YYYY-MM-DD</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: Preview ── */}
      {step === 'preview' && parsedRows.length > 0 && (
        <div className="flex flex-col gap-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Rows', value: parsedRows.length, cls: 'text-foreground', bg: 'bg-white' },
              { label: 'Valid', value: commitableCount, cls: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Errors', value: errorCount, cls: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Duplicates', value: dupCount, cls: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.bg} border border-border rounded-xl p-4`}>
                <p className="text-xs text-muted-foreground font-500">{kpi.label}</p>
                <p className={`text-2xl font-700 mt-1 ${kpi.cls}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Warnings banner */}
          {warnCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertCircle size={15} />
              <span>{warnCount} row{warnCount > 1 ? 's have' : ' has'} warnings but will still be committed unless you remove them.</span>
            </div>
          )}

          {/* Filter + Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'valid', 'warning', 'error', 'duplicate'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize ${
                    filterStatus === f
                      ? 'bg-primary text-white border-primary' :'bg-white text-foreground/70 border-border hover:bg-muted'
                  }`}
                >
                  {f === 'all' ? `All (${parsedRows.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${parsedRows.filter(r => r.status === f).length})`}
                </button>
              ))}
            </div>
            <button
              onClick={handleCommit}
              disabled={commitableCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
              Commit {commitableCount} Record{commitableCount !== 1 ? 's' : ''}
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Rows Table */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-12">Row</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Collateral ID</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Obligor</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Value (TZS)</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Registry</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(row => (
                    <React.Fragment key={row.rowIndex}>
                      <tr
                        className={`border-b border-border/60 hover:bg-muted/20 cursor-pointer transition-colors ${
                          row.status === 'error' || row.status === 'duplicate' ? 'bg-red-50/30' :
                          row.status === 'warning' ? 'bg-amber-50/30' : ''
                        }`}
                        onClick={() => toggleRow(row.rowIndex)}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{row.rowIndex}</td>
                        <td className="px-4 py-3 font-mono text-xs font-600 text-foreground">{row.mapped.collateral_id || <span className="text-red-400 italic">missing</span>}</td>
                        <td className="px-4 py-3 text-xs text-foreground/80 max-w-[160px] truncate">{row.mapped.obligor || '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground/80">{row.mapped.type || '—'}</td>
                        <td className="px-4 py-3 text-xs text-foreground/80 font-mono">
                          {row.mapped.value_tzs ? row.mapped.value_tzs.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-foreground/80">{row.mapped.registry || '—'}</td>
                        <td className="px-4 py-3">{statusBadge(row.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expandedRows.has(row.rowIndex) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {expandedRows.has(row.rowIndex) && (
                        <tr className="border-b border-border/60 bg-muted/10">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="flex flex-col gap-3">
                              {row.errors.length > 0 && (
                                <div>
                                  <p className="text-xs font-600 text-red-700 mb-1.5 flex items-center gap-1"><XCircle size={12} /> Errors</p>
                                  <ul className="space-y-1">
                                    {row.errors.map((e, i) => (
                                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                                        <span className="mt-0.5 shrink-0">•</span>{e}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {row.warnings.length > 0 && (
                                <div>
                                  <p className="text-xs font-600 text-amber-700 mb-1.5 flex items-center gap-1"><AlertTriangle size={12} /> Warnings</p>
                                  <ul className="space-y-1">
                                    {row.warnings.map((w, i) => (
                                      <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                                        <span className="mt-0.5 shrink-0">•</span>{w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {row.errors.length === 0 && row.warnings.length === 0 && (
                                <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> All validations passed</p>
                              )}
                              {/* Raw data */}
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-500">Show raw values</summary>
                                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 font-mono">
                                  {Object.entries(row.raw).map(([k, v]) => (
                                    <div key={k} className="flex gap-1">
                                      <span className="text-muted-foreground shrink-0">{k}:</span>
                                      <span className="text-foreground/80 truncate">{v || '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No rows match the selected filter</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: Committing ── */}
      {step === 'committing' && (
        <div className="bg-white border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <RefreshCw size={18} className="animate-spin text-primary" />
            <h2 className="text-base font-600 text-foreground">Committing records to database…</h2>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {parsedRows
              .filter(r => r.status === 'valid' || r.status === 'warning')
              .map(row => {
                const s = commitProgress[row.rowIndex] ?? 'pending';
                return (
                  <div key={row.rowIndex} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                    {commitStatusIcon(s)}
                    <span className="text-xs font-mono font-600 text-foreground/80 w-32 truncate">{row.mapped.collateral_id}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{row.mapped.obligor}</span>
                    <span className={`text-xs font-500 ${s === 'done' ? 'text-emerald-600' : s === 'failed' ? 'text-red-500' : s === 'committing' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {s === 'pending' ? 'Queued' : s === 'committing' ? 'Saving…' : s === 'done' ? 'Saved' : 'Failed'}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── STEP: Done ── */}
      {step === 'done' && summary && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-700 text-foreground">Upload Complete</h2>
                <p className="text-sm text-muted-foreground">Batch processing finished</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Total in File', value: summary.total, cls: '' },
                { label: 'Successfully Committed', value: summary.committed, cls: 'text-emerald-700' },
                { label: 'Failed to Commit', value: summary.failed, cls: summary.failed > 0 ? 'text-red-700' : '' },
                { label: 'Skipped (Errors)', value: summary.errors, cls: summary.errors > 0 ? 'text-red-700' : '' },
                { label: 'Skipped (Duplicates)', value: summary.duplicates, cls: summary.duplicates > 0 ? 'text-purple-700' : '' },
                { label: 'Committed with Warnings', value: summary.warnings, cls: summary.warnings > 0 ? 'text-amber-700' : '' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className={`text-xl font-700 mt-0.5 ${kpi.cls || 'text-foreground'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {summary.failed > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{summary.failed} record{summary.failed > 1 ? 's' : ''} failed to commit. Check the database connection or duplicate constraints and retry.</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-600 hover:bg-primary/90 transition-colors"
              >
                <Upload size={14} />
                Upload Another File
              </button>
              <a
                href="/collateral-management"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-white text-sm font-600 text-foreground/80 hover:bg-muted transition-colors"
              >
                <Eye size={14} />
                View Collateral Registry
              </a>
            </div>
          </div>

          {/* Per-row result */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-600 text-foreground">Commit Results</p>
            </div>
            <div className="divide-y divide-border/60 max-h-80 overflow-y-auto">
              {parsedRows
                .filter(r => r.status === 'valid' || r.status === 'warning')
                .map(row => {
                  const s = commitProgress[row.rowIndex] ?? 'pending';
                  return (
                    <div key={row.rowIndex} className="flex items-center gap-3 px-4 py-2.5">
                      {commitStatusIcon(s)}
                      <span className="text-xs font-mono font-600 text-foreground/80 w-32 truncate">{row.mapped.collateral_id}</span>
                      <span className="text-xs text-muted-foreground flex-1 truncate">{row.mapped.obligor}</span>
                      <span className={`text-xs font-500 ${s === 'done' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {s === 'done' ? 'Committed' : 'Failed'}
                      </span>
                    </div>
                  );
                })}
              {parsedRows
                .filter(r => r.status === 'error' || r.status === 'duplicate')
                .map(row => (
                  <div key={row.rowIndex} className="flex items-center gap-3 px-4 py-2.5 bg-red-50/30">
                    <XCircle size={14} className="text-red-400 shrink-0" />
                    <span className="text-xs font-mono font-600 text-foreground/80 w-32 truncate">{row.mapped.collateral_id || `Row ${row.rowIndex}`}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{row.errors[0]}</span>
                    <span className="text-xs font-500 text-red-500">Skipped</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
