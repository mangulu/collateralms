'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, Search, Building2, User, MapPin, Phone, Mail, RefreshCw, AlertCircle, X, AlertTriangle, Loader2, Edit2, Trash2, Eye,  } from 'lucide-react';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { useAuth } from '@/contexts/AuthContext';
import ObligorFormModal from './ObligorFormModal';

const riskConfig = {
  LOW: { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200', dot: 'bg-green-500' },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', dot: 'bg-amber-500' },
  HIGH: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', dot: 'bg-red-500' },
};

export default function ObligorsContent() {
  const { user } = useAuth();
  const [obligors, setObligors] = useState<Obligor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'company'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'LOW' | 'MEDIUM' | 'HIGH'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Obligor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obligorService.getAll();
      setObligors(data);
    } catch {
      setError('Failed to load obligors. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = obligors.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      o.fullName.toLowerCase().includes(q) ||
      o.obligorCode.toLowerCase().includes(q) ||
      (o.email ?? '').toLowerCase().includes(q) ||
      (o.city ?? '').toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || o.entityType === typeFilter;
    const matchRisk = riskFilter === 'all' || o.riskRating === riskFilter;
    return matchSearch && matchType && matchRisk;
  });

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const ok = await obligorService.delete(id);
    setDeleting(false);
    if (ok) {
      setObligors((prev) => prev.filter((o) => o.id !== id));
      setDeleteConfirm(null);
    }
  };

  const handleSaved = (saved: Obligor) => {
    setObligors((prev) => {
      const idx = prev.findIndex((o) => o.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowForm(false);
    setEditItem(null);
  };

  const stats = {
    total: obligors.length,
    companies: obligors.filter((o) => o.entityType === 'company').length,
    individuals: obligors.filter((o) => o.entityType === 'individual').length,
    highRisk: obligors.filter((o) => o.riskRating === 'HIGH').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Obligors</h1>
            <p className="text-sm text-muted-foreground">Manage borrower profiles, contacts, and linked collaterals</p>
          </div>
        </div>
        <button
          onClick={() => { setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus size={15} />
          Add Obligor
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Obligors', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Companies', value: stats.companies, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Individuals', value: stats.individuals, icon: User, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'High Risk', value: stats.highRisk, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
            <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-700 ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, code, email, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Types</option>
          <option value="company">Company</option>
          <option value="individual">Individual</option>
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as any)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Risk Levels</option>
          <option value="LOW">Low Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="HIGH">High Risk</option>
        </select>
        <button onClick={load} className="p-2 border border-border rounded-lg hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} />
          {error}
          <button onClick={load} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading obligors…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users size={22} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-600 text-foreground">No obligors found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || typeFilter !== 'all' || riskFilter !== 'all' ?'Try adjusting your filters' :'Add your first obligor to get started'}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Obligor</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide hidden md:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Risk</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((o) => {
                  const risk = riskConfig[o.riskRating as keyof typeof riskConfig] ?? riskConfig['MEDIUM'];
                  return (
                    <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${o.entityType === 'company' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                            {o.entityType === 'company'
                              ? <Building2 size={14} className="text-blue-600" />
                              : <User size={14} className="text-purple-600" />}
                          </div>
                          <div>
                            <p className="text-sm font-600 text-foreground">{o.fullName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{o.obligorCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {(o.city || o.region) ? (
                          <div className="flex items-center gap-1.5 text-sm text-foreground">
                            <MapPin size={12} className="text-muted-foreground shrink-0" />
                            <span>{[o.city, o.region].filter(Boolean).join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          {o.phonePrimary && (
                            <div className="flex items-center gap-1.5 text-xs text-foreground">
                              <Phone size={11} className="text-muted-foreground" />
                              {o.phonePrimary}
                            </div>
                          )}
                          {o.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail size={11} />
                              {o.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 border ${risk.bg} ${risk.color} ${risk.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                          {o.riskRating ?? 'MEDIUM'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/obligors/${o.id}`}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="View Profile"
                          >
                            <Eye size={14} />
                          </Link>
                          <button
                            onClick={() => { setEditItem(o); setShowForm(true); }}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(o.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-600 text-foreground">Delete Obligor</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-5">
              Are you sure you want to delete this obligor? Linked collateral records will not be deleted but will lose the obligor reference.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-600 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ObligorFormModal
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
