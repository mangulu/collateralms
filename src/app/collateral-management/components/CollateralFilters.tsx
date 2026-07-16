'use client';
import React from 'react';
import { FilterState } from './CollateralManagementContent';
import { X } from 'lucide-react';

interface CollateralFiltersProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClear: () => void;
  collateralTypes?: string[];
  registries?: string[];
  officers?: string[];
}

const statuses = [
  'Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected',
];

export default function CollateralFilters({
  filters,
  onChange,
  onClear,
  collateralTypes = [],
  registries = [],
  officers = [],
}: CollateralFiltersProps) {
  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="bg-white border border-border rounded-lg p-4 mb-4 fade-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-600 text-foreground">Filter Collateral Records</p>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
          Clear filters
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Type */}
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">
            Collateral Type
          </label>
          <select
            value={filters.type}
            onChange={(e) => set('type', e.target.value)}
            className="w-full px-2.5 py-2 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="">All types</option>
            {collateralTypes.map((t) => (
              <option key={`filter-type-${t}`} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Status */}
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">
            Perfection Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full px-2.5 py-2 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={`filter-status-${s}`} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {/* Registry */}
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">
            Registry
          </label>
          <select
            value={filters.registry}
            onChange={(e) => set('registry', e.target.value)}
            className="w-full px-2.5 py-2 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="">All registries</option>
            {registries.map((r) => (
              <option key={`filter-reg-${r}`} value={r}>{r}</option>
            ))}
          </select>
        </div>
        {/* Officer */}
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">
            Assigned Officer
          </label>
          <select
            value={filters.officer}
            onChange={(e) => set('officer', e.target.value)}
            className="w-full px-2.5 py-2 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
          >
            <option value="">All officers</option>
            {officers.map((o) => (
              <option key={`filter-officer-${o}`} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}