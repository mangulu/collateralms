'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Pencil, Trash2, Save, X, CheckCircle2, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, RefreshCw, AlertCircle,
} from 'lucide-react';
import {
  collateralTypeRequiredDocsService,
  CollateralTypeRequiredDoc,
} from '@/lib/supabase/collateralTypeRequiredDocsService';
import { createClient } from '@/lib/supabase/client';

interface CollateralType {
  id: string;
  name: string;
}

interface EditState {
  id: string | null;
  collateralTypeName: string;
  documentName: string;
  description: string;
  isMandatory: boolean;
}

const emptyEdit = (typeName: string): EditState => ({
  id: null,
  collateralTypeName: typeName,
  documentName: '',
  description: '',
  isMandatory: true,
});

export default function CollateralTypeDocumentsSettingsContent() {
  const [collateralTypes, setCollateralTypes] = useState<CollateralType[]>([]);
  const [grouped, setGrouped] = useState<Record<string, CollateralTypeRequiredDoc[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [typesResult, groupedDocs] = await Promise.all([
        supabase.from('collateral_types').select('id, name').order('sort_order', { ascending: true }),
        collateralTypeRequiredDocsService.getAllGrouped(),
      ]);
      const typesData = typesResult.data;
      const types: CollateralType[] = (typesData ?? []).map((r: any) => ({ id: r.id, name: r.name }));
      setCollateralTypes(types);
      setGrouped(groupedDocs);
      // Auto-expand all types on first load
      const expanded: Record<string, boolean> = {};
      types.forEach((t) => { expanded[t.name] = true; });
      setExpandedTypes((prev) => ({ ...expanded, ...prev }));
    } catch {
      showToast('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (typeName: string) =>
    setExpandedTypes((prev) => ({ ...prev, [typeName]: !prev[typeName] }));

  const openAdd = (typeName: string) => setEdit(emptyEdit(typeName));
  const openEdit = (doc: CollateralTypeRequiredDoc) =>
    setEdit({
      id: doc.id,
      collateralTypeName: doc.collateralTypeName,
      documentName: doc.documentName,
      description: doc.description,
      isMandatory: doc.isMandatory,
    });

  const handleSave = async () => {
    if (!edit || !edit.documentName.trim()) return;
    setSaving(true);
    try {
      if (edit.id) {
        const updated = await collateralTypeRequiredDocsService.update(edit.id, {
          documentName: edit.documentName.trim(),
          description: edit.description.trim(),
          isMandatory: edit.isMandatory,
        });
        if (updated) {
          setGrouped((prev) => ({
            ...prev,
            [edit.collateralTypeName]: (prev[edit.collateralTypeName] ?? []).map((d) =>
              d.id === edit.id ? updated : d
            ),
          }));
          showToast('Document updated.', 'success');
        } else {
          showToast('Failed to update document.', 'error');
        }
      } else {
        const existing = grouped[edit.collateralTypeName] ?? [];
        const created = await collateralTypeRequiredDocsService.create({
          collateralTypeName: edit.collateralTypeName,
          documentName: edit.documentName.trim(),
          description: edit.description.trim(),
          isMandatory: edit.isMandatory,
          sortOrder: existing.length + 1,
        });
        if (created) {
          setGrouped((prev) => ({
            ...prev,
            [edit.collateralTypeName]: [...(prev[edit.collateralTypeName] ?? []), created],
          }));
          showToast('Document added.', 'success');
        } else {
          showToast('Failed to add document. It may already exist for this type.', 'error');
        }
      }
      setEdit(null);
    } catch {
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const ok = await collateralTypeRequiredDocsService.delete(deleteTarget.id);
      if (ok) {
        setGrouped((prev) => {
          const updated: Record<string, CollateralTypeRequiredDoc[]> = {};
          for (const [type, docs] of Object.entries(prev)) {
            updated[type] = docs.filter((d) => d.id !== deleteTarget.id);
          }
          return updated;
        });
        showToast('Document removed.', 'success');
      } else {
        showToast('Failed to remove document.', 'error');
      }
    } catch {
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleMandatory = async (doc: CollateralTypeRequiredDoc) => {
    const updated = await collateralTypeRequiredDocsService.update(doc.id, {
      isMandatory: !doc.isMandatory,
    });
    if (updated) {
      setGrouped((prev) => ({
        ...prev,
        [doc.collateralTypeName]: (prev[doc.collateralTypeName] ?? []).map((d) =>
          d.id === doc.id ? updated : d
        ),
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Required Documents per Collateral Type</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure which documents are required for each collateral type. These drive the checklist shown on collateral profiles.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
          toast.type === 'success' ?'bg-green-50 border-green-200 text-green-700' :'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} className="shrink-0" />
            : <AlertCircle size={15} className="shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={15} className="shrink-0" />
            Remove <strong>{deleteTarget.name}</strong> from the checklist?
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Remove
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : collateralTypes.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No collateral types found. Add types in the <strong>Collateral Types</strong> tab first.
        </div>
      ) : (
        <div className="space-y-3">
          {collateralTypes.map((ct) => {
            const docs = grouped[ct.name] ?? [];
            const isExpanded = expandedTypes[ct.name] ?? true;
            const mandatoryCount = docs.filter((d) => d.isMandatory).length;

            return (
              <div key={ct.id} className="bg-card rounded-lg border border-border shadow-card overflow-hidden">
                {/* Type header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/60">
                  <button
                    onClick={() => toggleExpand(ct.name)}
                    className="flex items-center gap-2.5 flex-1 text-left"
                  >
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText size={12} className="text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{ct.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {docs.length} doc{docs.length !== 1 ? 's' : ''} · {mandatoryCount} mandatory
                    </span>
                    {isExpanded
                      ? <ChevronUp size={14} className="text-muted-foreground ml-auto" />
                      : <ChevronDown size={14} className="text-muted-foreground ml-auto" />}
                  </button>
                  <button
                    onClick={() => openAdd(ct.name)}
                    className="flex items-center gap-1.5 ml-3 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                {isExpanded && (
                  <div className="divide-y divide-border/50">
                    {/* Inline add/edit form */}
                    {edit !== null && edit.collateralTypeName === ct.name && (
                      <div className="px-4 py-4 bg-primary/5 border-b border-primary/20 space-y-3">
                        <h4 className="text-xs font-semibold text-foreground">
                          {edit.id ? 'Edit Document' : `Add Document — ${ct.name}`}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">
                              Document Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={edit.documentName}
                              onChange={(e) => setEdit({ ...edit, documentName: e.target.value })}
                              placeholder="e.g. Vehicle Registration Certificate"
                              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Description</label>
                            <input
                              type="text"
                              value={edit.description}
                              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                              placeholder="Optional description"
                              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={edit.isMandatory}
                            onChange={(e) => setEdit({ ...edit, isMandatory: e.target.checked })}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-sm text-foreground">Mandatory (shown in checklist)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSave}
                            disabled={!edit.documentName.trim() || saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                          <button
                            onClick={() => setEdit(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                          >
                            <X size={12} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {docs.length === 0 ? (
                      <div className="px-4 py-4 text-xs text-muted-foreground italic">
                        No documents configured. Click <strong>Add</strong> to define the required checklist for {ct.name}.
                      </div>
                    ) : (
                      docs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{doc.documentName}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleMandatory(doc)}
                            title="Toggle mandatory"
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:opacity-80 cursor-pointer shrink-0 ${
                              doc.isMandatory
                                ? 'bg-red-100 text-red-700' :'bg-muted text-muted-foreground'
                            }`}
                          >
                            {doc.isMandatory ? 'Mandatory' : 'Optional'}
                          </button>
                          <button
                            onClick={() => openEdit(doc)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors shrink-0"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: doc.id, name: doc.documentName })}
                            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
