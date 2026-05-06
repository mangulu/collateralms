'use client';
import React, { useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Save, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
  expiryTracked: boolean;
}

const defaultTypes: DocumentType[] = [
  { id: '1', name: 'Title Deed', description: 'Official land or property ownership document', required: true, expiryTracked: false },
  { id: '2', name: 'Certificate of Incorporation', description: 'Company registration certificate from BRELA', required: true, expiryTracked: false },
  { id: '3', name: 'Insurance Certificate', description: 'Asset insurance policy document', required: true, expiryTracked: true },
  { id: '4', name: 'Valuation Report', description: 'Independent property or asset valuation', required: true, expiryTracked: true },
  { id: '5', name: 'Board Resolution', description: 'Board approval for collateral pledge', required: false, expiryTracked: false },
  { id: '6', name: 'Mortgage Deed', description: 'Registered mortgage instrument', required: true, expiryTracked: false },
  { id: '7', name: 'Share Certificate', description: 'Equity share ownership certificate', required: false, expiryTracked: false },
  { id: '8', name: 'Vessel Registration', description: 'TASAC vessel registration document', required: false, expiryTracked: true },
];

interface EditState {
  id: string | null;
  name: string;
  description: string;
  required: boolean;
  expiryTracked: boolean;
}

const emptyEdit: EditState = { id: null, name: '', description: '', required: false, expiryTracked: false };

export default function DocumentTypesSettingsContent() {
  const [types, setTypes] = useState<DocumentType[]>(defaultTypes);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const openAdd = () => setEdit({ ...emptyEdit });
  const openEdit = (dt: DocumentType) =>
    setEdit({ id: dt.id, name: dt.name, description: dt.description, required: dt.required, expiryTracked: dt.expiryTracked });

  const handleSave = () => {
    if (!edit || !edit.name.trim()) return;
    if (edit.id) {
      setTypes((prev) => prev.map((t) => (t.id === edit.id ? { ...t, ...edit } as DocumentType : t)));
    } else {
      setTypes((prev) => [...prev, { id: Date.now().toString(), name: edit.name.trim(), description: edit.description.trim(), required: edit.required, expiryTracked: edit.expiryTracked }]);
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

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Document Types</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure the types of documents accepted for collateral records.
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
          <h3 className="text-sm font-semibold text-foreground">{edit.id ? 'Edit Document Type' : 'New Document Type'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="e.g. Title Deed"
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
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={edit.required}
                onChange={(e) => setEdit({ ...edit, required: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground">Required document</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={edit.expiryTracked}
                onChange={(e) => setEdit({ ...edit, expiryTracked: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-foreground">Track expiry date</span>
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!edit.name.trim()}
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Description</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expiry</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {types.map((dt) => (
              <tr key={dt.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-primary shrink-0" />
                    <span className="font-medium text-foreground">{dt.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{dt.description || '—'}</td>
                <td className="px-4 py-3 text-center">
                  {dt.required ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Required</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Optional</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {dt.expiryTracked ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Tracked</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {deleteId === dt.id ? (
                      <>
                        <span className="text-xs text-red-600 mr-1 flex items-center gap-1"><AlertTriangle size={12} />Delete?</span>
                        <button onClick={() => handleDelete(dt.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors">Yes</button>
                        <button onClick={() => setDeleteId(null)} className="px-2 py-1 text-xs border border-border rounded hover:bg-muted transition-colors">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openEdit(dt)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteId(dt.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {types.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No document types configured. Click <strong>Add Type</strong> to get started.
          </div>
        )}
      </div>
    </div>
  );
}
