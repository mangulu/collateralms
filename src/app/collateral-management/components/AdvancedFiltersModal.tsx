import React, { useState } from 'react';
import { X, Calendar, DollarSign, Filter } from 'lucide-react';
import { FilterState } from './CollateralManagementContent';

interface AdvancedFiltersModalProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
}

export default function AdvancedFiltersModal({ open, onClose, filters, onApply }: AdvancedFiltersModalProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  if (!open) return null;

  const handleApply = () => {
    onApply(localFilters);
  };

  const handleClear = () => {
    setLocalFilters({
      search: filters.search,
      type: '',
      status: '',
      registry: '',
      officer: '',
      dateFrom: '',
      dateTo: '',
      minValue: '',
      maxValue: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-foreground">Advanced Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground" />
              Registration Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="date"
                  value={localFilters.dateFrom || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="date"
                  value={localFilters.dateTo || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Value Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <DollarSign size={14} className="text-muted-foreground" />
              Value Range (TSh)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Min</label>
                <input
                  type="number"
                  placeholder="0"
                  value={localFilters.minValue || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, minValue: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max</label>
                <input
                  type="number"
                  placeholder="100000000"
                  value={localFilters.maxValue || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxValue: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Filters</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {Object.entries(localFilters).filter(([k, v]) => v && k !== 'search').length === 0 ? (
                <span className="text-sm text-muted-foreground">No active filters</span>
              ) : (
                Object.entries(localFilters).map(([key, value]) => {
                  if (!value || key === 'search') return null;
                  const label = key === 'dateFrom' ? 'From' :
                               key === 'dateTo' ? 'To' :
                               key === 'minValue' ? 'Min Value' :
                               key === 'maxValue' ? 'Max Value' :
                               key.charAt(0).toUpperCase() + key.slice(1);
                  return (
                    <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                      {label}: {value}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30 rounded-b-2xl">
          <button
            onClick={handleClear}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}