'use client';
import React, { useState, useEffect } from 'react';
import { Search, X, FileText, FolderOpen, ScrollText, Users, ChevronRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';


interface SearchResult {
  id: string;
  type: 'collateral' | 'document' | 'audit' | 'user';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

const TYPE_CONFIG = {
  collateral: { icon: FolderOpen, label: 'Collateral', color: 'text-blue-600', bg: 'bg-blue-50' },
  document: { icon: FileText, label: 'Document', color: 'text-purple-600', bg: 'bg-purple-50' },
  audit: { icon: ScrollText, label: 'Audit Log', color: 'text-amber-600', bg: 'bg-amber-50' },
  user: { icon: Users, label: 'User', color: 'text-green-600', bg: 'bg-green-50' },
};

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setSelectedIdx(0); }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = async (q: string) => {
    setLoading(true);
    const supabase = createClient();
    const term = `%${q}%`;
    const found: SearchResult[] = [];

    try {
      // Search collateral records
      const { data: cols } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, obligor, collateral_type, status')
        .or(`collateral_id.ilike.${term},obligor.ilike.${term},facility_id.ilike.${term}`)
        .limit(5);

      (cols ?? []).forEach((r: any) => {
        found.push({
          id: r.id,
          type: 'collateral',
          title: r.collateral_id,
          subtitle: `${r.obligor} · ${r.collateral_type}`,
          href: `/collateral-management`,
          badge: r.status,
          badgeColor: r.status === 'Perfected' ? 'bg-green-100 text-green-700' : r.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
        });
      });

      // Search documents
      const { data: docs } = await supabase
        .from('collateral_documents')
        .select('id, file_name, document_type, collateral_id')
        .or(`file_name.ilike.${term},document_type.ilike.${term}`)
        .limit(4);

      (docs ?? []).forEach((r: any) => {
        found.push({
          id: r.id,
          type: 'document',
          title: r.file_name,
          subtitle: `${r.document_type} · ${r.collateral_id}`,
          href: `/collateral-documents`,
          badge: r.document_type,
          badgeColor: 'bg-purple-100 text-purple-700',
        });
      });

      // Search audit logs
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, action, message, collateral_id, performed_by_name')
        .or(`message.ilike.${term},collateral_id.ilike.${term},performed_by_name.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(4);

      (logs ?? []).forEach((r: any) => {
        found.push({
          id: r.id,
          type: 'audit',
          title: r.message || r.action,
          subtitle: `${r.collateral_id ?? 'System'} · by ${r.performed_by_name ?? 'Unknown'}`,
          href: `/audit-trail`,
          badge: r.action,
          badgeColor: 'bg-amber-100 text-amber-700',
        });
      });

      // Search users
      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(3);

      (users ?? []).forEach((r: any) => {
        found.push({
          id: r.id,
          type: 'user',
          title: r.full_name || r.email,
          subtitle: `${r.email} · ${(r.role ?? '').replace(/_/g, ' ')}`,
          href: `/user-management`,
          badge: r.role?.replace(/_/g, ' '),
          badgeColor: 'bg-green-100 text-green-700',
        });
      });
    } catch { /* silent */ }

    setResults(found);
    setSelectedIdx(0);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) {
      router.push(results[selectedIdx].href);
      setOpen(false);
    }
  };

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors w-full max-w-xs"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search everything…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-border rounded text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={18} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search collaterals, documents, audit logs, users…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 size={16} className="text-muted-foreground animate-spin shrink-0" />}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-8 text-center">
                  <Search size={24} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Type at least 2 characters to search</p>
                  <p className="text-xs text-muted-foreground mt-1">Searches collaterals, documents, audit logs, and users</p>
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No results for "<strong>{query}</strong>"</p>
                </div>
              ) : (
                <div className="py-2">
                  {(Object.keys(grouped) as Array<keyof typeof TYPE_CONFIG>).map((type) => {
                    const cfg = TYPE_CONFIG[type];
                    const Icon = cfg.icon;
                    return (
                      <div key={type}>
                        <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
                        {grouped[type].map((r, i) => {
                          const globalIdx = results.indexOf(r);
                          return (
                            <button
                              key={r.id}
                              onClick={() => { router.push(r.href); setOpen(false); }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors ${globalIdx === selectedIdx ? 'bg-muted' : ''}`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                <Icon size={13} className={cfg.color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                              </div>
                              {r.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${r.badgeColor}`}>{r.badge}</span>
                              )}
                              <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-border rounded font-mono">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-border rounded font-mono">↵</kbd> Open</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white border border-border rounded font-mono">Esc</kbd> Close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
