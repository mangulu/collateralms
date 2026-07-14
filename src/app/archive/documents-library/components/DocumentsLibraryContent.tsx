'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Library, Search, RefreshCw, AlertCircle, FileText, FileImage, FileType2, File, Download, Clock, Link2, Filter,  } from 'lucide-react';
import { documentService, CollateralDocument } from '@/lib/supabase/documentService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import DocumentVersionHistoryModal from '@/components/DocumentVersionHistoryModal';
import { useAuth } from '@/contexts/AuthContext';

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={18} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={18} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={18} className="text-indigo-500" />;
  return <FileText size={18} className="text-slate-500" />;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsLibraryContent() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<CollateralDocument[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [versionDoc, setVersionDoc] = useState<CollateralDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, cols] = await Promise.all([
        documentService.getAll(),
        collateralService.getAll(),
      ]);
      setDocuments(docs);
      setCollaterals(cols);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const collateralMap = Object.fromEntries(collaterals.map((c) => [c.id, c]));
  const docTypes = Array.from(new Set(documents.map((d) => d.document_type)));

  const filtered = documents.filter((d) => {
    const q = search.toLowerCase();
    const col = collateralMap[d.collateral_id];
    const matchSearch = !q || d.file_name?.toLowerCase().includes(q) || col?.owner_name?.toLowerCase().includes(q) || d.document_type?.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || d.document_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Documents Library</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>All collateral documents with version history — physical and electronic</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
          <RefreshCw size={16} style={{ color: '#2563EB' }} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Documents', value: documents.length, color: '#1D4ED8' },
          { label: 'Document Types', value: docTypes.length, color: '#15803D' },
          { label: 'Collaterals Covered', value: new Set(documents.map((d) => d.collateral_id)).size, color: '#7E22CE' },
          { label: 'With Notes', value: documents.filter((d) => d.notes).length, color: '#B45309' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
            placeholder="Search by file name, owner, type…" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-8 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF', color: '#374151' }}>
            <option value="all">All Types</option>
            {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Library size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No documents found</p>
          <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>Documents uploaded via Collateral Documents will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const col = collateralMap[doc.collateral_id];
            return (
              <div key={doc.id} className="flex items-center gap-4 p-4 rounded-xl group"
                style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                  {getFileIcon(doc.mime_type ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E3A8A' }}>{doc.file_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                      {doc.document_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {col && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                        <Link2 size={11} /> {col.collateral_type} — {col.owner_name}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatFileSize(doc.file_size ?? 0)}</span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                      <Clock size={11} /> {formatDate(doc.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setVersionDoc(doc)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                    style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                    <Clock size={12} /> History
                  </button>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                      style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>
                      <Download size={12} /> Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {versionDoc && (
        <DocumentVersionHistoryModal
          document={versionDoc}
          onClose={() => setVersionDoc(null)}
        />
      )}
    </div>
  );
}
