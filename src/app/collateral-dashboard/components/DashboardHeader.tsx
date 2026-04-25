'use client';
import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardHeader() {
  const [lastUpdated, setLastUpdated] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLastUpdated(new Date()?.toLocaleString('en-TZ', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Backend integration point: GET /api/dashboard/refresh
    await new Promise((r) => setTimeout(r, 1200));
    setRefreshing(false);
    setLastUpdated(new Date()?.toLocaleString('en-TZ', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
    toast?.success('Dashboard refreshed');
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-700 text-foreground">Collateral Dashboard</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-500 rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Portfolio health overview · EXIM Bank Tanzania
          {lastUpdated && (
            <span className="ml-2 text-xs">· Last updated: {lastUpdated}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:border-primary/40 cursor-pointer transition-colors">
          <Calendar size={14} />
          <span>Apr 2026</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
        <button
          onClick={() => toast?.info('Export report — PDF generation queued')}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-md text-sm font-500 hover:bg-primary/90 transition-all active:scale-95"
        >
          <Download size={14} />
          <span>Export Report</span>
        </button>
      </div>
    </div>
  );
}