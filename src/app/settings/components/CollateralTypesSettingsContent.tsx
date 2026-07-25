'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Pencil, Trash2, Save, X, CheckCircle2, AlertTriangle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CollateralType {
  id: string;
  name: string;
  description: string;
  perfectionDeadlineDays: number | null;
  registryCode: string;
  active: boolean;
  sortOrder: number;
}

interface EditState {
  id: string | null;
  name: string;
  description: string;
  perfectionDeadlineDays: string;
  registryCode: string;
  active: boolean;
}

const emptyEdit: EditState = { id: null, name: '', description: '', perfectionDeadlineDays: '', registryCode: '', active: true };

const registryOptions = ['BRELA', 'TRA', 'LANDS', 'TASAC', 'DSE', 'MVRA', 'TCAA', 'Other'];

const registryBadge: Record<string, string> = {
  BRELA: 'bg-blue-100 text-blue-700',
  TRA: 'bg-amber-100 text-amber-700',
  LANDS: 'bg-green-100 text-green-700',
  TASAC: 'bg-cyan-100 text-cyan-700',
  DSE: 'bg-purple-100 text-purple-700',
  MVRA: 'bg-orange-100 text-orange-700',
  TCAA: 'bg-rose-100 text-rose-700',
};

function rowToType(row: any): CollateralType {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    perfectionDeadlineDays: row.perfection_deadline_days ?? null,
    registryCode: row.registry_code ?? '',
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
  };
}

export default function CollateralTypesSettingsContent() {
  const [types, setTypes] = useState<CollateralType[]>([]);
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

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collateral_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setTypes((data ?? []).map(rowToType));
    } catch (err: any) {
      setFetchError(err?.message ?? 'Failed to load collateral types.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const openAdd = () => setEdit({ ...emptyEdit });
  const openEdit = (ct: CollateralType) =>
    setEdit({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      perfectionDeadlineDays: ct.perfectionDeadlineDays !== null ? String(ct.perfectionDeadlineDays) : '',
      registryCode: ct.registryCode,
      active: ct.active,
    });

  const handleSave = async () => {
    if (!edit || !edit.name.trim()) return;
    const days = edit.perfectionDeadlineDays.trim() !== '' ? parseInt(edit.perfectionDeadlineDays, 10) : null;
    setSaving(true);
    try {
      const supabase = createClient();
      if (edit.id) {
        const { error } = await supabase
          .from('collateral_types')
          .update({
            name: edit.name.trim(),
            description: edit.description.trim() || null,
            perfection_deadline_days: isNaN(days as number) ? null : days,
            registry_code: edit.registryCode || null,
            active: edit.active,
          })
          .eq('id', edit.id);
        if (error) throw error;
        showToast('Collateral type updated.', 'success');
      } else {
        const maxOrder = types.length > 0 ? Math.max(...types.map((t) => t.sortOrder)) + 1 : 0;
        const { error } = await supabase
          .from('collateral_types')
          .insert({
            name: edit.name.trim(),
            description: edit.description.trim() || null,
            perfection_deadline_days: isNaN(days as number) ? null : days,
            registry_code: edit.registryCode || null,
            active: edit.active,
            sort_order: maxOrder,
          });
        if (error) throw error;
        showToast('Collateral type added.', 'success');
      }
      setEdit(null);
      await fetchTypes();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save collateral type.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('collateral_types').delete().eq('id', id);
      if (error) throw error;
      setDeleteId(null);
      showToast('Collateral type removed.', 'success');
      await fetchTypes();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete collateral type.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('collateral_types')
        .update({ active: !currentActive })
        .eq('id', id);
      if (error) throw error;
      showToast(`Type ${!currentActive ? 'activated' : 'deactivated'}.`, 'success');
      await fetchTypes();
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to update type.', 'error');
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTypes}
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
            Add Type
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
                {registryOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Description</label>
              <input
                type="text"
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder="Short description of this collateral type"
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
              disabled={!edit.name.trim() || saving}
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

      {/* Loading */}
      {isLoading && (
        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!isLoading && fetchError && (
        <div className="flex items-center gap-3 px-4 py-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={18} className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">Failed to load collateral types</p>
            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
          </div>
          <button onClick={fetchTypes} className="text-xs text-red-600 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !fetchError && (
        <div className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collateral Type</th>
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
                      <button onClick={() => toggleActive(ct.id, ct.active)} className="focus:outline-none">
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
                            <button
                              onClick={() => handleDelete(ct.id)}
                              disabled={deleting}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {deleting ? '…' : 'Yes'}
                            </button>
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
      )}
    </div>
  );
}
