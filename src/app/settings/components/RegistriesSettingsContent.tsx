'use client';
import React, { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, Save, X, CheckCircle2, Globe } from 'lucide-react';

interface Registry {
  id: string;
  code: string;
  name: string;
  fullName: string;
  country: string;
  assetClass: string;
  active: boolean;
}

const defaultRegistries: Registry[] = [
  { id: '1', code: 'BRELA', name: 'BRELA', fullName: 'Business Registrations and Licensing Agency', country: 'Tanzania', assetClass: 'Corporate / Business Assets', active: true },
  { id: '2', code: 'TRA', name: 'TRA', fullName: 'Tanzania Revenue Authority', country: 'Tanzania', assetClass: 'Tax Compliance & Clearance', active: true },
  { id: '3', code: 'LANDS', name: 'Land Registry', fullName: 'Ministry of Lands – Property Registry', country: 'Tanzania', assetClass: 'Real Estate / Land', active: true },
  { id: '4', code: 'TASAC', name: 'TASAC', fullName: 'Tanzania Shipping Agencies Corporation', country: 'Tanzania', assetClass: 'Vessels / Maritime Assets', active: true },
  { id: '5', code: 'DSE', name: 'DSE', fullName: 'Dar es Salaam Stock Exchange', country: 'Tanzania', assetClass: 'Listed Securities / Equities', active: true },
  { id: '6', code: 'MVRA', name: 'MVRA', fullName: 'Motor Vehicle Registration Authority', country: 'Tanzania', assetClass: 'Motor Vehicles', active: true },
  { id: '7', code: 'TCAA', name: 'TCAA', fullName: 'Tanzania Civil Aviation Authority', country: 'Tanzania', assetClass: 'Aircraft / Aviation Assets', active: false },
];

interface EditState {
  id: string | null;
  code: string;
  name: string;
  fullName: string;
  country: string;
  assetClass: string;
  active: boolean;
}

const emptyEdit: EditState = { id: null, code: '', name: '', fullName: '', country: 'Tanzania', assetClass: '', active: true };

const colorForCode: Record<string, string> = {
  BRELA: 'bg-blue-100 text-blue-700',
  TRA: 'bg-amber-100 text-amber-700',
  LANDS: 'bg-green-100 text-green-700',
  TASAC: 'bg-cyan-100 text-cyan-700',
  DSE: 'bg-purple-100 text-purple-700',
  MVRA: 'bg-orange-100 text-orange-700',
  TCAA: 'bg-rose-100 text-rose-700',
};

export default function RegistriesSettingsContent() {
  const [registries, setRegistries] = useState<Registry[]>(defaultRegistries);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openAdd = () => setEdit({ ...emptyEdit });
  const openEdit = (r: Registry) =>
    setEdit({ id: r.id, code: r.code, name: r.name, fullName: r.fullName, country: r.country, assetClass: r.assetClass, active: r.active });

  const handleSave = () => {
    if (!edit || !edit.name.trim() || !edit.code.trim()) return;
    if (edit.id) {
      setRegistries((prev) => prev.map((r) => (r.id === edit.id ? { ...r, ...edit } as Registry : r)));
    } else {
      setRegistries((prev) => [
        ...prev,
        { id: Date.now().toString(), code: edit.code.trim().toUpperCase(), name: edit.name.trim(), fullName: edit.fullName.trim(), country: edit.country.trim(), assetClass: edit.assetClass.trim(), active: edit.active },
      ]);
    }
    setEdit(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = (id: string) => {
    setRegistries((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleActive = (id: string) => {
    setRegistries((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Registries</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage the registries used for collateral perfection and verification (e.g. BRELA, TRA, Land Registry, TASAC, DSE).
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} />
          Add Registry
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
          <h3 className="text-sm font-semibold text-foreground">{edit.id ? 'Edit Registry' : 'New Registry'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={edit.code}
                onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                placeholder="e.g. BRELA"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Short Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="e.g. BRELA"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={edit.fullName}
                onChange={(e) => setEdit({ ...edit, fullName: e.target.value })}
                placeholder="e.g. Business Registrations and Licensing Agency"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Country</label>
              <input
                type="text"
                value={edit.country}
                onChange={(e) => setEdit({ ...edit, country: e.target.value })}
                placeholder="Tanzania"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Asset Class</label>
              <input
                type="text"
                value={edit.assetClass}
                onChange={(e) => setEdit({ ...edit, assetClass: e.target.value })}
                placeholder="e.g. Real Estate / Land"
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
            <span className="text-sm text-foreground">Active (available for selection in collateral forms)</span>
          </label>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!edit.name.trim() || !edit.code.trim()}
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

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {registries.map((r) => {
          const badgeCls = colorForCode[r.code] ?? 'bg-gray-100 text-gray-700';
          return (
            <div key={r.id} className={`bg-card rounded-lg border shadow-card p-4 space-y-3 ${r.active ? 'border-border' : 'border-border/40 opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${badgeCls}`}>{r.code}</span>
                  {!r.active && <span className="text-xs text-muted-foreground">(Inactive)</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors">
                    <Pencil size={13} />
                  </button>
                  {deleteId === r.id ? (
                    <>
                      <button onClick={() => handleDelete(r.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Del</button>
                      <button onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors">No</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{r.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.fullName}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe size={12} />
                <span>{r.country}</span>
              </div>
              {r.assetClass && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 size={12} />
                  <span>{r.assetClass}</span>
                </div>
              )}
              <div className="pt-1 border-t border-border/50">
                <button
                  onClick={() => toggleActive(r.id)}
                  className={`text-xs font-medium transition-colors ${r.active ? 'text-green-600 hover:text-red-600' : 'text-muted-foreground hover:text-green-600'}`}
                >
                  {r.active ? '● Active — click to deactivate' : '○ Inactive — click to activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {registries.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground bg-card rounded-lg border border-border">
          No registries configured. Click <strong>Add Registry</strong> to get started.
        </div>
      )}
    </div>
  );
}
