'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Pencil, Trash2, Save, X, CheckCircle2, Globe, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Registry {
  id: string;
  code: string;
  name: string;
  fullName: string;
  country: string;
  assetClass: string;
  active: boolean;
  sortOrder: number;
}

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
  'Lands Registry': 'bg-green-100 text-green-700',
  TASAC: 'bg-cyan-100 text-cyan-700',
  DSE: 'bg-purple-100 text-purple-700',
  MVRA: 'bg-orange-100 text-orange-700',
  TCAA: 'bg-rose-100 text-rose-700',
};

function rowToRegistry(row: any): Registry {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    fullName: row.full_name ?? '',
    country: row.country ?? 'Tanzania',
    assetClass: row.asset_class ?? '',
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

export default function RegistriesSettingsContent() {
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRegistries = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('registries')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setRegistries((data ?? []).map(rowToRegistry));
    } catch (err: any) {
      setFetchError(err?.message ?? 'Failed to load registries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistries();
  }, [fetchRegistries]);

  const openAdd = () => setEdit({ ...emptyEdit });
  const openEdit = (r: Registry) =>
    setEdit({ id: r.id, code: r.code, name: r.name, fullName: r.fullName, country: r.country, assetClass: r.assetClass, active: r.active });

  const handleSave = async () => {
    if (!edit || !edit.name.trim() || !edit.code.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      if (edit.id) {
        const { error } = await supabase
          .from('registries')
          .update({
            code: edit.code.trim().toUpperCase(),
            name: edit.name.trim(),
            full_name: edit.fullName.trim() || null,
            country: edit.country.trim() || 'Tanzania',
            asset_class: edit.assetClass.trim() || null,
            active: edit.active,
          })
          .eq('id', edit.id);
        if (error) throw error;
        showToast('Registry updated successfully.', 'success');
      } else {
        const maxOrder = registries.length > 0 ? Math.max(...registries.map((r) => r.sortOrder)) + 1 : 0;
        const { error } = await supabase
          .from('registries')
          .insert({
            code: edit.code.trim().toUpperCase(),
            name: edit.name.trim(),
            full_name: edit.fullName.trim() || null,
            country: edit.country.trim() || 'Tanzania',
            asset_class: edit.assetClass.trim() || null,
            active: edit.active,
            sort_order: maxOrder,
          });
        if (error) throw error;
        showToast('Registry added successfully.', 'success');
      }
      setEdit(null);
      await fetchRegistries();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save registry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('registries').delete().eq('id', id);
      if (error) throw error;
      setDeleteId(null);
      showToast('Registry removed.', 'success');
      await fetchRegistries();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete registry.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('registries')
        .update({ active: !currentActive })
        .eq('id', id);
      if (error) throw error;
      showToast(`Registry ${!currentActive ? 'activated' : 'deactivated'}.`, 'success');
      await fetchRegistries();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update registry.', 'error');
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRegistries}
            disabled={isLoading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} />
            Add Registry
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
          toast.type === 'success' ?'bg-green-50 border-green-200 text-green-700' :'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
          {toast.message}
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
              disabled={!edit.name.trim() || !edit.code.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEdit(null)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg border border-border shadow-card p-4 h-36 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && fetchError && (
        <div className="flex items-center gap-3 px-4 py-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Failed to load registries</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
          </div>
          <button
            onClick={fetchRegistries}
            className="text-xs text-red-600 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && !fetchError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {registries.map((r) => {
            const badgeCls = colorForCode[r.code] ?? colorForCode[r.name] ?? 'bg-gray-100 text-gray-700';
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
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deleting ? '…' : 'Del'}
                        </button>
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
                  {r.fullName && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.fullName}</p>}
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
                    onClick={() => toggleActive(r.id, r.active)}
                    className={`text-xs font-medium transition-colors ${r.active ? 'text-green-600 hover:text-red-600' : 'text-muted-foreground hover:text-green-600'}`}
                  >
                    {r.active ? '● Active — click to deactivate' : '○ Inactive — click to activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !fetchError && registries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No registries configured</p>
          <p className="text-xs mt-1">Click <strong>Add Registry</strong> to create the first one.</p>
        </div>
      )}
    </div>
  );
}
