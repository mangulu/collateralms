'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, Upload, FileText, Trash2, Download, Clock, X, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { CollateralRecord as Collateral } from '@/lib/supabase/collateralService';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { useAuth } from '@/contexts/AuthContext';

interface FormData {
  obligor: string;
  obligorId: string;
  type: string;
  description: string;
  valueTS: string;
  facilityId: string;
  registry: string;
  registrationDate: string;
  perfectionDeadline: string;
  assignedOfficer: string;
  requiresPerfection: boolean;
}

interface AddEditCollateralModalProps {
  open: boolean;
  editItem: Collateral | null;
  onClose: () => void;
  onSave: (data: Partial<Collateral>) => Promise<void>;
}

const collateralTypes = [
  'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel',
];
const registries = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
const officers = ['J. Kamau', 'A. Mwangi', 'P. Ochieng', 'S. Ndege'];
const documentTypes: DocumentType[] = [
  'Title Deed', 'Charge Certificate', 'Valuation Report', 'BRELA Confirmation',
  'Insurance Certificate', 'Board Resolution', 'Other',
];

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type ActiveTab = 'details' | 'documents';

export default function AddEditCollateralModal({
  open,
  editItem,
  onClose,
  onSave,
}: AddEditCollateralModalProps) {
  const { user, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState<{ full_name?: string } | null>(null);

  useEffect(() => {
    if (user) {
      getUserProfile().then((p: any) => setUserProfile(p)).catch(() => {});
    }
  }, [user]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('details');
  const [brelaError, setBrelaError] = useState<string | null>(null);

  // Document state
  const [documents, setDocuments] = useState<CollateralDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; docType: DocumentType; notes: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const requiresPerfection = watch('requiresPerfection');
  const registryValue = watch('registry');
  const registrationDateValue = watch('registrationDate');

  // Auto-calculate BRELA 42-day perfection deadline when execution date or registry changes
  useEffect(() => {
    if (
      requiresPerfection &&
      registryValue === 'BRELA' &&
      registrationDateValue
    ) {
      try {
        const execDate = new Date(registrationDateValue);
        if (!isNaN(execDate.getTime())) {
          const deadline = new Date(execDate);
          deadline.setDate(deadline.getDate() + 42);
          const yyyy = deadline.getFullYear();
          const mm = String(deadline.getMonth() + 1).padStart(2, '0');
          const dd = String(deadline.getDate()).padStart(2, '0');
          setValue('perfectionDeadline', `${yyyy}-${mm}-${dd}`, { shouldValidate: false });
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [registryValue, registrationDateValue, requiresPerfection, setValue]);

  // Load documents when editing
  useEffect(() => {
    if (editItem?.id && open) {
      setDocsLoading(true);
      documentService.getByCollateralId(editItem.id).then((docs) => {
        setDocuments(docs);
        setDocsLoading(false);
      });
    } else {
      setDocuments([]);
    }
  }, [editItem?.id, open]);

  useEffect(() => {
    if (open) {
      setActiveTab('details');
      setPendingFiles([]);
      setUploadError(null);
      setBrelaError(null);
    }
  }, [open]);

  useEffect(() => {
    if (editItem) {
      reset({
        obligor: editItem.obligor,
        obligorId: editItem.obligorId,
        type: editItem.type,
        description: editItem.description,
        valueTS: editItem.valueTSh,
        facilityId: editItem.facilityId,
        registry: editItem.registry,
        registrationDate: editItem.registrationDate,
        perfectionDeadline: editItem.perfectionDeadline,
        assignedOfficer: editItem.assignedOfficer,
        requiresPerfection: editItem.requiresPerfection,
      });
    } else {
      reset({
        obligor: '', obligorId: '', type: '', description: '', valueTS: '',
        facilityId: '', registry: '', registrationDate: '', perfectionDeadline: '',
        assignedOfficer: '', requiresPerfection: true,
      });
    }
  }, [editItem, open, reset]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `${file.name}: Unsupported file type. Use PDF, JPG, PNG, or DOCX.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File exceeds 10MB limit.`;
    }
    return null;
  };

  const addPendingFiles = useCallback((files: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(files);
    const errors: string[] = [];
    const valid: { file: File; docType: DocumentType; notes: string }[] = [];

    fileArray.forEach((file) => {
      const err = validateFile(file);
      if (err) errors.push(err);
      else valid.push({ file, docType: 'Other', notes: '' });
    });

    if (errors.length > 0) setUploadError(errors.join(' '));
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addPendingFiles(e.dataTransfer.files);
  }, [addPendingFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addPendingFiles(e.target.files);
    e.target.value = '';
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePendingDocType = (idx: number, docType: DocumentType) => {
    setPendingFiles((prev) => prev.map((p, i) => i === idx ? { ...p, docType } : p));
  };

  const updatePendingNotes = (idx: number, notes: string) => {
    setPendingFiles((prev) => prev.map((p, i) => i === idx ? { ...p, notes } : p));
  };

  const uploadPendingFiles = async (collateralRecordId: string, collateralId: string) => {
    if (!pendingFiles.length || !user) return;
    setUploading(true);
    const userName = userProfile?.full_name || user.email || 'Unknown';
    const results = await Promise.all(
      pendingFiles.map((pf) =>
        documentService.upload(
          pf.file, collateralRecordId, collateralId,
          pf.docType, pf.notes, user.id, userName
        )
      )
    );
    const uploaded = results.filter(Boolean) as CollateralDocument[];
    if (uploaded.length > 0) {
      setDocuments((prev) => [...uploaded, ...prev]);
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const handleDeleteDocument = async (doc: CollateralDocument) => {
    const ok = await documentService.delete(doc);
    if (ok) setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  };

  const onSubmit = async (data: FormData) => {
    const savedData: Partial<Collateral> = {
      obligor: data.obligor,
      obligorId: data.obligorId,
      type: data.type as Collateral['type'],
      description: data.description,
      valueTSh: data.valueTS,
      facilityId: data.facilityId,
      registry: data.registry as Collateral['registry'],
      registrationDate: data.registrationDate,
      perfectionDeadline: data.requiresPerfection ? data.perfectionDeadline : '',
      assignedOfficer: data.assignedOfficer,
      requiresPerfection: data.requiresPerfection,
    };

    // If editing and there are pending files, upload them now
    if (editItem?.id && pendingFiles.length > 0) {
      await uploadPendingFiles(editItem.id, editItem.collateralId);
    }

    try {
      await onSave(savedData);
    } catch (err: any) {
      // Surface DB-level BRELA validation errors in the form
      const msg: string = err?.message ?? '';
      const brelaMatch = msg.match(/BRELA_VALIDATION:\s*(.+)/);
      if (brelaMatch) {
        setBrelaError(brelaMatch[1].trim());
      } else {
        setBrelaError('Failed to save collateral record. Please check your inputs and try again.');
      }
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    return '📎';
  };

  const docBadgeColor: Record<DocumentType, string> = {
    'Title Deed': 'bg-blue-100 text-blue-700',
    'Charge Certificate': 'bg-purple-100 text-purple-700',
    'Valuation Report': 'bg-green-100 text-green-700',
    'BRELA Confirmation': 'bg-amber-100 text-amber-700',
    'Insurance Certificate': 'bg-teal-100 text-teal-700',
    'Board Resolution': 'bg-rose-100 text-rose-700',
    'Other': 'bg-gray-100 text-gray-600',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editItem ? `Edit Collateral — ${editItem.id}` : 'Register New Collateral'}
      subtitle={
        editItem
          ? `Updating record for ${editItem.obligor}`
          : 'Complete all required fields to register a new collateral item'
      }
      size="xl"
    >
      {/* BRELA / DB Validation Error Banner */}
      {brelaError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
          <AlertCircle size={15} className="text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-600 text-destructive">Validation Error</p>
            <p className="text-xs text-destructive mt-0.5">{brelaError}</p>
          </div>
          <button type="button" onClick={() => setBrelaError(null)} className="text-destructive/60 hover:text-destructive">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6 -mt-1">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`px-4 py-2.5 text-sm font-500 border-b-2 transition-colors ${
            activeTab === 'details' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Collateral Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2.5 text-sm font-500 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'documents'
              ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Documents & History
          {(documents.length > 0 || pendingFiles.length > 0) && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs font-600">
              {documents.length + pendingFiles.length}
            </span>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* ── DETAILS TAB ── */}
        <div className={activeTab === 'details' ? 'block' : 'hidden'}>
          {/* Section 1: Obligor & Facility */}
          <div className="mb-6">
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">1</span>
              Obligor & Facility Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Obligor / Borrower Name <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Full legal name of the entity providing this collateral</p>
                <input
                  type="text"
                  placeholder="e.g. Karibu Enterprises Ltd"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.obligor ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('obligor', { required: 'Obligor name is required' })}
                />
                {errors.obligor && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.obligor.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Obligor ID <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Internal customer reference (e.g. OBL-2024-0441)</p>
                <input
                  type="text"
                  placeholder="OBL-YYYY-NNNN"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.obligorId ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('obligorId', {
                    required: 'Obligor ID is required',
                    pattern: { value: /^OBL-\d{4}-\d{4}$/, message: 'Format must be OBL-YYYY-NNNN' },
                  })}
                />
                {errors.obligorId && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.obligorId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Facility / Loan ID <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">The loan facility this collateral secures (e.g. TZ-FAC-2025-0441)</p>
                <input
                  type="text"
                  placeholder="TZ-FAC-YYYY-NNNN"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.facilityId ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('facilityId', {
                    required: 'Facility ID is required',
                    pattern: { value: /^TZ-FAC-\d{4}-\d{4}$/, message: 'Format must be TZ-FAC-YYYY-NNNN' },
                  })}
                />
                {errors.facilityId && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.facilityId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Assigned Credit Officer <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Officer responsible for managing this collateral record</p>
                <select
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.assignedOfficer ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('assignedOfficer', { required: 'Assigned officer is required' })}
                >
                  <option value="">Select officer...</option>
                  {officers.map((o) => <option key={`officer-opt-${o}`} value={o}>{o}</option>)}
                </select>
                {errors.assignedOfficer && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.assignedOfficer.message}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Collateral Details */}
          <div className="mb-6">
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">2</span>
              Collateral Asset Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Collateral Type <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Security category — determines applicable registry and perfection rules</p>
                <select
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.type ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('type', { required: 'Collateral type is required' })}
                >
                  <option value="">Select type...</option>
                  {collateralTypes.map((t) => <option key={`type-opt-${t}`} value={t}>{t}</option>)}
                </select>
                {errors.type && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.type.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Collateral Value (TSh) <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Current forced-sale or market value in Tanzanian Shillings</p>
                <input
                  type="text"
                  placeholder="e.g. 780,000,000"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.valueTS ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('valueTS', {
                    required: 'Collateral value is required',
                    pattern: { value: /^[\d,]+$/, message: 'Enter numeric value only (e.g. 780,000,000)' },
                  })}
                />
                {errors.valueTS && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.valueTS.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-500 text-foreground mb-1">
                  Asset Description <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Full legal description — include plot number, title deed details, chassis number, or other identifying information</p>
                <textarea
                  rows={3}
                  placeholder="e.g. Plot 245, Block D, Kinondoni, Dar es Salaam — Title Deed Vol. 18 Folio 99"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors resize-none ${errors.description ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('description', {
                    required: 'Asset description is required',
                    minLength: { value: 20, message: 'Description must be at least 20 characters' },
                  })}
                />
                {errors.description && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.description.message}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Perfection & Registry */}
          <div className="mb-6">
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">3</span>
              Perfection & Registry Details
            </h3>
            <div className="flex items-start gap-3 mb-4 p-3 bg-muted/50 rounded-lg border border-border">
              <input
                id="requiresPerfection"
                type="checkbox"
                className="w-4 h-4 mt-0.5 rounded border-border accent-primary cursor-pointer"
                {...register('requiresPerfection')}
              />
              <div>
                <label htmlFor="requiresPerfection" className="text-sm font-500 text-foreground cursor-pointer">
                  This collateral requires perfection (registry submission)
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uncheck for guarantees and FDRs that do not require external registry submission.
                  BRELA debentures and mortgages must be perfected within 42 days of execution.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Target Registry {requiresPerfection && <span className="text-destructive">*</span>}
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">External registry where this collateral must be registered</p>
                <select
                  disabled={!requiresPerfection}
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${errors.registry ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('registry', {
                    validate: (value) => !requiresPerfection || value !== '' || 'Registry is required when perfection is needed',
                  })}
                >
                  <option value="">Select registry...</option>
                  {registries.map((r) => <option key={`reg-opt-${r}`} value={r}>{r}</option>)}
                </select>
                {errors.registry && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.registry.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Collateral Execution Date <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">Date the security document was signed/executed — the 42-day BRELA clock starts here</p>
                <input
                  type="date"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.registrationDate ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                  {...register('registrationDate', { required: 'Execution date is required' })}
                />
                {errors.registrationDate && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.registrationDate.message}</p>}
              </div>
              {requiresPerfection && (
                <div>
                  <label className="block text-sm font-500 text-foreground mb-1">
                    Perfection Deadline <span className="text-destructive">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-1.5">For BRELA debentures: execution date + 42 days. Set earlier for other registries.</p>
                  <input
                    type="date"
                    className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${errors.perfectionDeadline ? 'border-destructive' : 'border-border hover:border-primary/40'}`}
                    {...register('perfectionDeadline', {
                      validate: (value) => !requiresPerfection || value !== '' || 'Perfection deadline is required',
                    })}
                  />
                  {errors.perfectionDeadline && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{errors.perfectionDeadline.message}</p>}
                </div>
              )}
            </div>
            {requiresPerfection && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800 font-500">
                  ⚠️ BRELA 42-Day Rule: Debentures must be submitted to BRELA within 42 days of execution date.
                  Failure to register within this period renders the charge void against a liquidator or administrator.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── DOCUMENTS TAB ── */}
        <div className={activeTab === 'documents' ? 'block' : 'hidden'}>
          {!editItem && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-500">
                💡 Save the collateral record first, then upload supporting documents via the Edit action.
              </p>
            </div>
          )}

          {editItem && (
            <>
              {/* Upload Zone */}
              <div className="mb-5">
                <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
                  <Upload size={14} className="text-primary" />
                  Upload Documents
                </h3>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40'
                  }`}
                >
                  <Upload size={20} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-500 text-muted-foreground mb-0.5">
                    Drag & drop files here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG, DOCX — max 10MB each
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>

                {uploadError && (
                  <div className="mt-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                    <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive">{uploadError}</p>
                  </div>
                )}

                {/* Pending Files Queue */}
                {pendingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-600 text-foreground">Ready to upload ({pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}):</p>
                    {pendingFiles.map((pf, idx) => (
                      <div key={`pending-${idx}`} className="flex items-start gap-2 p-2.5 bg-white border border-border rounded-lg">
                        <span className="text-lg leading-none mt-0.5">{getFileIcon(pf.file.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-500 text-foreground truncate">{pf.file.name}</p>
                          <p className="text-xs text-muted-foreground">{documentService.formatFileSize(pf.file.size)}</p>
                          <div className="mt-1.5 flex gap-2">
                            <select
                              value={pf.docType}
                              onChange={(e) => updatePendingDocType(idx, e.target.value as DocumentType)}
                              className="flex-1 px-2 py-1 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                            >
                              {documentTypes.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                            </select>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={pf.notes}
                              onChange={(e) => updatePendingNotes(idx, e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <button type="button" onClick={() => removePending(idx)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Version History */}
              <div>
                <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  Document Version History
                  {documents.length > 0 && (
                    <span className="ml-auto text-xs font-400 text-muted-foreground">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
                  )}
                </h3>

                {docsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Loading documents...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No documents uploaded yet</p>
                    <p className="text-xs mt-1">Upload title deeds, charge certificates, and other legal proof above</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-start gap-3 p-3 bg-white border border-border rounded-lg hover:border-primary/30 transition-colors group">
                        <span className="text-xl leading-none mt-0.5">{getFileIcon(doc.mimeType)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-500 text-foreground truncate max-w-[200px]">{doc.fileName}</p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-500 ${docBadgeColor[doc.documentType]}`}>
                              {doc.documentType}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                              v{doc.version}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{doc.uploadedByName}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{doc.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.signedUrl && (
                            <a
                              href={doc.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              title="Download"
                            >
                              <Download size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc)}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-6">
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Required fields
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-md text-sm font-500 text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{ minWidth: '160px', justifyContent: 'center' }}
            >
              {(isSubmitting || uploading) ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {uploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : editItem ? (
                pendingFiles.length > 0 ? `Save & Upload (${pendingFiles.length})` : 'Update Collateral'
              ) : (
                'Register Collateral'
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}