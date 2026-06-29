'use client';
import React, { useState } from 'react';
import { Layers, Plus, Pencil, Trash2, Save, X, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface CollateralType {
  id: string;
  name: string;
  description: string;
  perfectionAuthority: string;
  perfectionDeadlineDays: number | null;
  registryCode: string;
  active: boolean;
}

const defaultCollateralTypes: CollateralType[] = [
  { id: '1', name: 'Real Property / Land', description: 'Freehold and leasehold land and buildings', perfectionAuthority: 'Ministry of Lands – Land Registry', perfectionDeadlineDays: 90, registryCode: 'LANDS', active: true },
  { id: '2', name: 'Motor Vehicle', description: 'Cars, trucks, motorcycles and other road vehicles', perfectionAuthority: 'Motor Vehicle Registration Authority (MVRA)', perfectionDeadlineDays: 30, registryCode: 'MVRA', active: true },
  { id: '3', name: 'Business / Corporate Assets', description: 'Company shares, debentures, and business undertakings', perfectionAuthority: 'BRELA – Business Registrations and Licensing Agency', perfectionDeadlineDays: 42, registryCode: 'BRELA', active: true },
  { id: '4', name: 'Listed Securities / Equities', description: 'Shares listed on the Dar es Salaam Stock Exchange', perfectionAuthority: 'Dar es Salaam Stock Exchange (DSE)', perfectionDeadlineDays: 14, registryCode: 'DSE', active: true },
  { id: '5', name: 'Vessel / Maritime Asset', description: 'Ships, boats, and other watercraft', perfectionAuthority: 'Tanzania Shipping Agencies Corporation (TASAC)', perfectionDeadlineDays: 60, registryCode: 'TASAC', active: true },
  { id: '6', name: 'Aircraft', description: 'Fixed-wing aircraft and helicopters', perfectionAuthority: 'Tanzania Civil Aviation Authority (TCAA)', perfectionDeadlineDays: 60, registryCode: 'TCAA', active: true },
  { id: '7', name: 'Plant & Machinery', description: 'Industrial equipment and manufacturing machinery', perfectionAuthority: 'BRELA – Floating Charge Registration', perfectionDeadlineDays: 42, registryCode: 'BRELA', active: true },
  { id: '8', name: 'Agricultural Assets', description: 'Crops, livestock, and farm equipment', perfectionAuthority: 'Ministry of Agriculture / BRELA', perfectionDeadlineDays: 42, registryCode: 'BRELA', active: true },
  { id: '9', name: 'Cash / Fixed Deposit', description: 'Bank deposits and cash collateral', perfectionAuthority: 'Internal Bank Lien', perfectionDeadlineDays: null, registryCode: '', active: true },
  { id: '10', name: 'Intellectual Property', description: 'Patents, trademarks, and copyrights', perfectionAuthority: 'BRELA – IP Registry', perfectionDeadlineDays: 42, registryCode: 'BRELA', active: false },
];

const registryOptions = ['BRELA', 'TRA', 'LANDS', 'TASAC', 'DSE', 'MVRA', 'TCAA', 'Other', ''];

interface EditState {
  id: string | null;
  name: string;
  description: string;
  perfectionAuthority: string;
  perfectionDeadlineDays: string;
  registryCode: string;
  active: boolean;
}

const emptyEdit: EditState = { id: null, name: '', description: '', perfectionAuthority: '', perfectionDeadlineDays: '', registryCode: '', active: true };

export default function CollateralTypesSettingsContent() {
  const [types, setTypes] = useState<CollateralType[]>(defaultCollateralTypes);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openAdd = () => setEdit({ ...emptyEdit });
  const openEdit = (ct: CollateralType) =>
    setEdit({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      perfectionAuthority: ct.perfectionAuthority,
      perfectionDeadlineDays: ct.perfectionDeadlineDays !== null ? String(ct.perfectionDeadlineDays) : '',
      registryCode: ct.registryCode,
      active: ct.active,
    });

  const handleSave = () => {
    if (!edit || !edit.name.trim()) return;
    const days = edit.perfectionDeadlineDays.trim() !== '' ? parseInt(edit.perfectionDeadlineDays, 10) : null;
    if (edit.id) {
      setTypes((prev) =>
        prev.map((t) =>
          t.id === edit.id
            ? { ...t, name: edit.name.trim(), description: edit.description.trim(), perfectionAuthority: edit.perfectionAuthority.trim(), perfectionDeadlineDays: isNaN(days as number) ? null : days, registryCode: edit.registryCode, active: edit.active }
            : t
        )
      );
    } else {
      setTypes((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          name: edit.name.trim(),
          description: edit.description.trim(),
          perfectionAuthority: edit.perfectionAuthority.trim(),
          perfectionDeadlineDays: isNaN(days as number) ? null : days,
          registryCode: edit.registryCode,
          active: edit.active,
        },
      ]);
    }
    setEdit(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = (id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setDeleteId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleActive = (id: string) => {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, active: !t.active } : t)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const registryBadge: Record<string, string> = {
    BRELA: 'bg-blue-100 text-blue-700',
    TRA: 'bg-amber-100 text-amber-700',
    LANDS: 'bg-green-100 text-green-700',
    TASAC: 'bg-cyan-100 text-cyan-700',
    DSE: 'bg-purple-100 text-purple-700',
    MVRA: 'bg-orange-100 text-orange-700',
    TCAA: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Collateral Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define collateral categories and map each to its perfection authority and deadline.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          Add Type
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 size={15} className="shrink-0" />
          Changes saved successfully.
        </div>
      )}

      {/* Add / Edit Form */}
      {edit !== null && (
        <div className="bg-card border border-primary/30 rounded-lg p-5 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground">{edit.id ? 'Edit Collateral Type' : 'New Collateral Type'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="e.g. Real Property / Land"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Registry</label>
              <select
                value={edit.registryCode}
                onChange={(e) => setEdit({ ...edit, registryCode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— None / Internal —</option>
                {registryOptions.filter(Boolean).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Perfection Authority <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={edit.perfectionAuthority}
                onChange={(e) => setEdit({ ...edit, perfectionAuthority: e.target.value })}
                placeholder="e.g. Ministry of Lands – Land Registry"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Description</label>
              <input
                type="text"
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder="Short description"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Perfection Deadline (days)</label>
              <input
                type="number"
                min={1}
                value={edit.perfectionDeadlineDays}
                onChange={(e) => setEdit({ ...edit, perfectionDeadlineDays: e.target.value })}
                placeholder="e.g. 42"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={edit.active}
              onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-foreground">Active (available in collateral forms)</span>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!edit.name.trim() || !edit.perfectionAuthority.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              Save
            </button>
            <button
              onClick={() => setEdit(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collateral Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Perfection Authority</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Registry</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deadline</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {types.map((ct) => {
              const badgeCls = ct.registryCode ? (registryBadge[ct.registryCode] ?? 'bg-gray-100 text-gray-700') : '';
              return (
                <tr key={ct.id} className={`hover:bg-muted/20 transition-colors ${!ct.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{ct.name}</p>
                        {ct.description && <p className="text-xs text-muted-foreground">{ct.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Shield size={12} className="text-primary shrink-0" />
                      <span className="text-xs">{ct.perfectionAuthority || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {ct.registryCode ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${badgeCls}`}>{ct.registryCode}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Internal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ct.perfectionDeadlineDays !== null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {ct.perfectionDeadlineDays}d
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(ct.id)} className="focus:outline-none">
                      {ct.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {deleteId === ct.id ? (
                        <>
                          <span className="text-xs text-red-600 mr-1 flex items-center gap-1"><AlertTriangle size={12} />Delete?</span>
                          <button onClick={() => handleDelete(ct.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Yes</button>
                          <button onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors">No</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(ct)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteId(ct.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {types.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No collateral types configured. Click <strong>Add Type</strong> to get started.
          </div>
        )}
      </div>
    </div>
  );
}
