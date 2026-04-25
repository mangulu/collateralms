'use client';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { CollateralRecord as Collateral } from '@/lib/supabase/collateralService';

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
  onSave: (data: Partial<Collateral>) => void;
}

const collateralTypes = [
  'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel',
];
const registries = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
const officers = ['J. Kamau', 'A. Mwangi', 'P. Ochieng', 'S. Ndege'];

export default function AddEditCollateralModal({
  open,
  editItem,
  onClose,
  onSave,
}: AddEditCollateralModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const requiresPerfection = watch('requiresPerfection');

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
        obligor: '',
        obligorId: '',
        type: '',
        description: '',
        valueTS: '',
        facilityId: '',
        registry: '',
        registrationDate: '',
        perfectionDeadline: '',
        assignedOfficer: '',
        requiresPerfection: true,
      });
    }
  }, [editItem, open, reset]);

  const onSubmit = async (data: FormData) => {
    await new Promise((r) => setTimeout(r, 600));
    onSave({
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
    });
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
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Section 1: Obligor & Facility */}
        <div className="mb-6">
          <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">1</span>
            Obligor & Facility Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Obligor Name */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Obligor / Borrower Name <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Full legal name of the entity providing this collateral
              </p>
              <input
                type="text"
                placeholder="e.g. Karibu Enterprises Ltd"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.obligor ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('obligor', { required: 'Obligor name is required' })}
              />
              {errors.obligor && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.obligor.message}
                </p>
              )}
            </div>

            {/* Obligor ID */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Obligor ID <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Internal customer reference (e.g. OBL-2024-0441)
              </p>
              <input
                type="text"
                placeholder="OBL-YYYY-NNNN"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.obligorId ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('obligorId', {
                  required: 'Obligor ID is required',
                  pattern: {
                    value: /^OBL-\d{4}-\d{4}$/,
                    message: 'Format must be OBL-YYYY-NNNN',
                  },
                })}
              />
              {errors.obligorId && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.obligorId.message}
                </p>
              )}
            </div>

            {/* Facility ID */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Facility / Loan ID <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                The loan facility this collateral secures (e.g. TZ-FAC-2025-0441)
              </p>
              <input
                type="text"
                placeholder="TZ-FAC-YYYY-NNNN"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.facilityId ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('facilityId', {
                  required: 'Facility ID is required',
                  pattern: {
                    value: /^TZ-FAC-\d{4}-\d{4}$/,
                    message: 'Format must be TZ-FAC-YYYY-NNNN',
                  },
                })}
              />
              {errors.facilityId && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.facilityId.message}
                </p>
              )}
            </div>

            {/* Assigned Officer */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Assigned Credit Officer <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Officer responsible for managing this collateral record
              </p>
              <select
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.assignedOfficer ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('assignedOfficer', { required: 'Assigned officer is required' })}
              >
                <option value="">Select officer...</option>
                {officers.map((o) => (
                  <option key={`officer-opt-${o}`} value={o}>{o}</option>
                ))}
              </select>
              {errors.assignedOfficer && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.assignedOfficer.message}
                </p>
              )}
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
            {/* Type */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Collateral Type <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Security category — determines applicable registry and perfection rules
              </p>
              <select
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.type ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('type', { required: 'Collateral type is required' })}
              >
                <option value="">Select type...</option>
                {collateralTypes.map((t) => (
                  <option key={`type-opt-${t}`} value={t}>{t}</option>
                ))}
              </select>
              {errors.type && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.type.message}
                </p>
              )}
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Collateral Value (TSh) <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Current forced-sale or market value in Tanzanian Shillings
              </p>
              <input
                type="text"
                placeholder="e.g. 780,000,000"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.valueTS ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('valueTS', {
                  required: 'Collateral value is required',
                  pattern: {
                    value: /^[\d,]+$/,
                    message: 'Enter numeric value only (e.g. 780,000,000)',
                  },
                })}
              />
              {errors.valueTS && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.valueTS.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-500 text-foreground mb-1">
                Asset Description <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Full legal description — include plot number, title deed details, chassis number, or other identifying information
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Plot 245, Block D, Kinondoni, Dar es Salaam — Title Deed Vol. 18 Folio 99"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors resize-none ${
                  errors.description ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('description', {
                  required: 'Asset description is required',
                  minLength: { value: 20, message: 'Description must be at least 20 characters' },
                })}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.description.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Perfection & Registry */}
        <div className="mb-6">
          <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">3</span>
            Perfection & Registry Details
          </h3>

          {/* Requires Perfection Toggle */}
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
            {/* Registry */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Target Registry {requiresPerfection && <span className="text-destructive">*</span>}
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                External registry where this collateral must be registered
              </p>
              <select
                disabled={!requiresPerfection}
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  errors.registry ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('registry', {
                  validate: (value) =>
                    !requiresPerfection || value !== '' || 'Registry is required when perfection is needed',
                })}
              >
                <option value="">Select registry...</option>
                {registries.map((r) => (
                  <option key={`reg-opt-${r}`} value={r}>{r}</option>
                ))}
              </select>
              {errors.registry && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.registry.message}
                </p>
              )}
            </div>

            {/* Registration Date */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">
                Collateral Execution Date <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Date the security document was signed/executed — the 42-day BRELA clock starts here
              </p>
              <input
                type="date"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                  errors.registrationDate ? 'border-destructive' : 'border-border hover:border-primary/40'
                }`}
                {...register('registrationDate', { required: 'Execution date is required' })}
              />
              {errors.registrationDate && (
                <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={11} />{errors.registrationDate.message}
                </p>
              )}
            </div>

            {/* Perfection Deadline */}
            {requiresPerfection && (
              <div>
                <label className="block text-sm font-500 text-foreground mb-1">
                  Perfection Deadline <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-1.5">
                  For BRELA debentures: execution date + 42 days. Set earlier for other registries.
                </p>
                <input
                  type="date"
                  className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors ${
                    errors.perfectionDeadline ? 'border-destructive' : 'border-border hover:border-primary/40'
                  }`}
                  {...register('perfectionDeadline', {
                    validate: (value) =>
                      !requiresPerfection || value !== '' || 'Perfection deadline is required',
                  })}
                />
                {errors.perfectionDeadline && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={11} />{errors.perfectionDeadline.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* BRELA 42-day notice */}
          {requiresPerfection && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 font-500">
                ⚠️ BRELA 42-Day Rule: Debentures must be submitted to BRELA within 42 days of execution date.
                Failure to register within this period renders the charge void against a liquidator or administrator.
                Ensure the perfection deadline is set correctly.
              </p>
            </div>
          )}
        </div>

        {/* Section 4: Documents (placeholder) */}
        <div className="mb-6">
          <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">4</span>
            Supporting Documents
          </h3>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <p className="text-sm font-500 text-muted-foreground mb-1">
              Drag & drop documents here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Title deeds, charge certificates, valuation reports, BRELA confirmation letters (PDF, max 10MB each)
            </p>
            {/* Backend integration point: POST /api/collateral/:id/documents */}
            <button
              type="button"
              className="mt-3 px-3 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:bg-white transition-colors"
            >
              Browse Files
            </button>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-95"
              style={{ minWidth: '140px', justifyContent: 'center' }}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving...
                </>
              ) : editItem ? (
                'Update Collateral'
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