'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, RefreshCw, ExternalLink, AlertTriangle, Construction } from 'lucide-react';
import Link from 'next/link';
import { complianceRulesService, type ComplianceRuleDB } from '@/lib/supabase/complianceRulesService';

export default function ComplianceBreachLogContent() {
  const [rules, setRules] = useState<ComplianceRuleDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await complianceRulesService.fetchAll();
      setRules(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeRuleCount = rules.filter((r) => r.is_active).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-700 text-foreground">Compliance Breach Log</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Automated compliance rule breach detection</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Construction size={24} className="text-amber-600" />
          </div>
          <p className="text-base font-600 text-foreground">Breach detection isn't wired up yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {loading
              ? 'Loading compliance rules…'
              : activeRuleCount > 0
                ? `There ${activeRuleCount === 1 ? 'is' : 'are'} ${activeRuleCount} active compliance rule${activeRuleCount === 1 ? '' : 's'}, but nothing in the system currently evaluates live collateral or loan data against them — so no breach can be recorded here yet.`
                : 'No automated engine currently evaluates collateral or loan data against compliance rules, so breaches can\'t be recorded here yet.'}
          </p>
          <Link href="/compliance-rules" className="mt-4 text-sm font-600 text-primary hover:underline flex items-center gap-1">
            <ExternalLink size={11} />
            Manage Compliance Rules
          </Link>
        </div>
      </div>
    </div>
  );
}
