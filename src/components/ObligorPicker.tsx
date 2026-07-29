'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, User, X, Loader2, ChevronDown, Plus } from 'lucide-react';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import Link from 'next/link';

interface ObligorPickerProps {
  value: { id: string; name: string; code: string } | null;
  onChange: (val: { id: string; name: string; code: string } | null) => void;
  error?: string;
}

export default function ObligorPicker({ value, onChange, error }: ObligorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Obligor[]>([]);
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState<Obligor[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all obligors once on mount for quick filtering
  useEffect(() => {
    obligorService
      .getAll()
      .then(setAllLoaded)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults(allLoaded.slice(0, 20));
      return;
    }
    setLoading(true);
    const q = query.toLowerCase();
    const filtered = allLoaded.filter(
      (o) =>
        o.fullName.toLowerCase().includes(q) ||
        o.obligorCode.toLowerCase().includes(q) ||
        (o.email ?? '').toLowerCase().includes(q)
    );
    setResults(filtered.slice(0, 20));
    setLoading(false);
  }, [query, open, allLoaded]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (o: Obligor) => {
    onChange({ id: o.id, name: o.fullName, code: o.obligorCode });
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const toggleOpen = () => {
    setOpen((v) => !v);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          error ? 'border-destructive' : 'border-border hover:border-primary/40'
        }`}
      >
        {value ? (
          <>
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 size={11} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-500 text-foreground truncate block">{value.name}</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono shrink-0">{value.code}</span>
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <Search size={13} className="text-muted-foreground shrink-0" />
            <span className="text-muted-foreground flex-1">Search Obligor by name or code…</span>
            <ChevronDown size={13} className="text-muted-foreground shrink-0" />
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Searching…</span>
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-xs text-muted-foreground">No obligors found</p>
                <Link
                  href="/obligors"
                  target="_blank"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                >
                  <Plus size={11} /> Add new Obligor
                </Link>
              </div>
            ) : (
              results.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => handleSelect(o)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${o.entityType === 'company' ? 'bg-blue-100' : 'bg-purple-100'}`}
                  >
                    {o.entityType === 'company' ? (
                      <Building2 size={12} className="text-blue-600" />
                    ) : (
                      <User size={12} className="text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-500 text-foreground truncate">{o.fullName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{o.obligorCode}</p>
                  </div>
                  {o.riskRating && (
                    <span
                      className={`text-xs font-600 px-1.5 py-0.5 rounded shrink-0 ${
                        o.riskRating === 'HIGH'
                          ? 'bg-red-100 text-red-700'
                          : o.riskRating === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {o.riskRating}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
