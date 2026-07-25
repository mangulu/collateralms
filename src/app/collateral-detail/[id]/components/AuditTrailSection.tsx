'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { History, ChevronRight,  } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { auditLogService, AuditLogEntry } from '@/lib/supabase/auditLogService';

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

export default function AuditTrailSection({ collateral }: { collateral: CollateralRecord }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditLogService
      .getAll({ search: collateral.collateralId }, 50)
      .then((data) => {
        const filtered = data.filter(
          (e) => e.collateralId === collateral.collateralId || e.collateralRecordId === collateral.id
        );
        setEntries(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collateral.id, collateral.collateralId]);

  const actionColors: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    status_changed: 'bg-purple-100 text-purple-700',
    deleted: 'bg-red-100 text-red-700',
    submitted: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Security & Compliance Trail" icon={History} />
        <Link href="/audit-trail" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={11} />
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <History size={28} className="text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No audit entries found for this collateral</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${actionColors[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {(entry.action ?? '').replace(/_/g, ' ').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-500 text-foreground">{entry.message}</p>
                {entry.detail && <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{entry.performedByName}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                  {entry.ipAddress && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{entry.ipAddress}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
