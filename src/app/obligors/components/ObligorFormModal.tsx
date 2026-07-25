'use client';
import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Loader2, Building2, User, ChevronDown } from 'lucide-react';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  editItem: Obligor | null;
  onClose: () => void;
  onSaved: (saved: Obligor) => void;
}

const REGIONS = [
  'Dar es Salaam', 'Arusha', 'Kilimanjaro', 'Mwanza', 'Dodoma', 'Mbeya',
  'Morogoro', 'Tanga', 'Zanzibar', 'Kagera', 'Kigoma', 'Lindi', 'Mara',
  'Mtwara', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Singida', 'Tabora',
];

export default function ObligorFormModal({ editItem, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const [form, setForm] = useState({
    obligorCode: '',
    fullName: '',
    entityType: 'company\' as \'individual\' | \'company',
    idNumber: '',
    registrationNumber: '',
    taxId: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'Tanzania',
    postalCode: '',
    phonePrimary: '',
    phoneSecondary: '',
    email: '',
    contactPerson: '',
    riskRating: 'MEDIUM\' as \'LOW\' | \'MEDIUM\' | \'HIGH',
    creditLimit: '',
    notes: '',
    isActive: true,
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        obligorCode: editItem.obligorCode ?? '',
        fullName: editItem.fullName ?? '',
        entityType: editItem.entityType ?? 'company',
        idNumber: editItem.idNumber ?? '',
        registrationNumber: editItem.registrationNumber ?? '',
        taxId: editItem.taxId ?? '',
        addressLine1: editItem.addressLine1 ?? '',
        addressLine2: editItem.addressLine2 ?? '',
        city: editItem.city ?? '',
        region: editItem.region ?? '',
        country: editItem.country ?? 'Tanzania',
        postalCode: editItem.postalCode ?? '',
        phonePrimary: editItem.phonePrimary ?? '',
        phoneSecondary: editItem.phoneSecondary ?? '',
        email: editItem.email ?? '',
        contactPerson: editItem.contactPerson ?? '',
        riskRating: (editItem.riskRating ?? 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH',
        creditLimit: editItem.creditLimit != null ? String(editItem.creditLimit) : '',
        notes: editItem.notes ?? '',
        isActive: editItem.isActive ?? true,
      });
    } else {
      // Auto-generate code for new obligors
      setGeneratingCode(true);
      obligorService.generateCode().then((code) => {
        setForm((prev) => ({ ...prev, obligorCode: code }));
        setGeneratingCode(false);
      }).catch(() => setGeneratingCode(false));
    }
  }, [editItem]);

  const set = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.obligorCode.trim()) { setError('Obligor code is required.'); return; }

    setSaving(true);
    setError(null);

    const payload: Partial<Obligor> = {
      obligorCode: form.obligorCode.trim(),
      fullName: form.fullName.trim(),
      entityType: form.entityType,
      idNumber: form.idNumber || null,
      registrationNumber: form.registrationNumber || null,
      taxId: form.taxId || null,
      addressLine1: form.addressLine1 || null,
      addressLine2: form.addressLine2 || null,
      city: form.city || null,
      region: form.region || null,
      country: form.country || 'Tanzania',
      postalCode: form.postalCode || null,
      phonePrimary: form.phonePrimary || null,
      phoneSecondary: form.phoneSecondary || null,
      email: form.email || null,
      contactPerson: form.contactPerson || null,
      riskRating: form.riskRating,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit.replace(/,/g, '')) : null,
      notes: form.notes || null,
      isActive: form.isActive,
    };

    let result: Obligor | null = null;
    if (editItem) {
      result = await obligorService.update(editItem.id, payload);
    } else {
      result = await obligorService.create(payload, user?.id ?? '');
    }

    setSaving(false);
    if (!result) {
      setError('Failed to save obligor. Please try again.');
      return;
    }
    onSaved(result);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors';
  const labelCls = 'block text-xs font-600 text-foreground mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-700 text-foreground">
              {editItem ? 'Edit Obligor' : 'Add New Obligor'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {editItem ? `Editing ${editItem.obligorCode}` : 'Register a new borrower profile'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Section 1: Identity */}
          <div>
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">1</span>
              Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Entity Type <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  {(['company', 'individual'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('entityType', t)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-500 transition-colors ${
                        form.entityType === t
                          ? 'bg-primary text-white border-primary' :'bg-white text-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {t === 'company' ? <Building2 size={14} /> : <User size={14} />}
                      {t === 'company' ? 'Company' : 'Individual'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Obligor Code <span className="text-destructive">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.obligorCode}
                    onChange={(e) => set('obligorCode', e.target.value)}
                    placeholder="OBL-YYYY-NNNN"
                    className={`${inputCls} font-mono ${generatingCode ? 'opacity-60' : ''}`}
                    readOnly={generatingCode}
                  />
                  {generatingCode && (
                    <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Full Legal Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  placeholder={form.entityType === 'company' ? 'e.g. Karibu Enterprises Ltd' : 'e.g. John Mwamba'}
                  className={inputCls}
                />
              </div>
              {form.entityType === 'individual' && (
                <div>
                  <label className={labelCls}>National ID Number</label>
                  <input type="text" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} placeholder="NIDA / Passport number" className={inputCls} />
                </div>
              )}
              {form.entityType === 'company' && (
                <div>
                  <label className={labelCls}>Registration Number</label>
                  <input type="text" value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="BRELA / Company reg. no." className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>TIN / Tax ID</label>
                <input type="text" value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="TRA Tax Identification Number" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Section 2: Address */}
          <div>
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">2</span>
              Address
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Address Line 1</label>
                <input type="text" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="Street, Plot number" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address Line 2</label>
                <input type="text" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} placeholder="Building, Floor, Suite" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Dar es Salaam" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <div className="relative">
                  <select value={form.region} onChange={(e) => set('region', e.target.value)} className={`${inputCls} appearance-none pr-8`}>
                    <option value="">Select region…</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input type="text" value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Postal Code</label>
                <input type="text" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Section 3: Contacts */}
          <div>
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">3</span>
              Contacts
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Primary Phone</label>
                <input type="tel" value={form.phonePrimary} onChange={(e) => set('phonePrimary', e.target.value)} placeholder="+255 XXX XXX XXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Secondary Phone</label>
                <input type="tel" value={form.phoneSecondary} onChange={(e) => set('phoneSecondary', e.target.value)} placeholder="+255 XXX XXX XXX" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contact@company.co.tz" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contact Person</label>
                <input type="text" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Primary contact name" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Section 4: Risk */}
          <div>
            <h3 className="text-sm font-600 text-foreground mb-3 pb-2 border-b border-border flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-700">4</span>
              Risk & Limits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Risk Rating</label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set('riskRating', r)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-600 transition-colors ${
                        form.riskRating === r
                          ? r === 'LOW' ? 'bg-green-600 text-white border-green-600'
                            : r === 'MEDIUM'? 'bg-amber-500 text-white border-amber-500' :'bg-red-600 text-white border-red-600' :'bg-white text-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Credit Limit (TSh)</label>
                <input type="text" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} placeholder="e.g. 500,000,000" className={`${inputCls} font-mono`} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes about this obligor…"
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => set('isActive', e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm font-500 text-foreground">Active obligor</span>
                </label>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Obligor'}
          </button>
        </div>
      </div>
    </div>
  );
}
