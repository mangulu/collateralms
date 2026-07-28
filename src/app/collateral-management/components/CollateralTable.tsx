'use client';
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Eye, Pencil, ChevronLeft, ChevronRight, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CollateralRecord as Collateral, CollateralStatus } from '@/lib/supabase/collateralService';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { FolderOpen } from 'lucide-react';

// Helper to format TSh values compactly
function fmtTShCompact(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

type SortKey = keyof Collateral;
type SortDir = 'asc' | 'desc';

interface CollateralTableProps {
  data: Collateral[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  allIds: string[];
  onEdit: (item: Collateral) => void;
  onView: (item: Collateral) => void;
  onStatusChange: (id: string, status: CollateralStatus) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
}

const statusBadgeMap: Record<CollateralStatus, 'perfected' | 'pending' | 'overdue' | 'draft' | 'released' | 'monitoring' | 'rejected' | 'under-review' | 'submitted'> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'under-review',
  Perfected: 'perfected',
  Monitoring: 'monitoring',
  Released: 'released',
  Overdue: 'overdue',
  Rejected: 'rejected',
};

const registryColors: Record<string, string> = {
  BRELA: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Lands Registry': 'bg-teal-50 text-teal-700 border border-teal-200',
  TRA: 'bg-purple-50 text-purple-700 border border-purple-200',
  DSE: 'bg-orange-50 text-orange-700 border border-orange-200',
  TASAC: 'bg-pink-50 text-pink-700 border border-pink-200',
  'N/A': 'bg-gray-50 text-gray-500 border border-gray-200',
};

const columns = [
  { key: 'id', label: 'Collateral ID', sortable: true },
  { key: 'obligor', label: 'Obligor', sortable: true },
  { key: 'type', label: 'Type', sortable: true },
  { key: 'description', label: 'Description', sortable: false },
  { key: 'valueTS', label: 'Value (TSh)', sortable: false },
  { key: 'facilityId', label: 'Facility ID', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'registry', label: 'Registry', sortable: true },
  { key: 'perfectionDeadline', label: 'Deadline', sortable: true },
  { key: 'assignedOfficer', label: 'Officer', sortable: true },
];

export default function CollateralTable({
  data,
  selectedIds,
  onSelectChange,
  allIds,
  onEdit,
  onView,
  onStatusChange,
  currentPage,
  totalPages,
  totalCount,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}: CollateralTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key as SortKey);
      setSortDir('asc');
    }
  };

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectChange([]);
    } else {
      onSelectChange(allIds);
    }
  };

  const toggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  const statusOptions: CollateralStatus[] = [
    'Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Rejected',
  ];

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                  aria-label="Select all rows"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={`th-${col.key}`}
                  className={`px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''
                  } ${sortKey === col.key ? 'text-primary' : ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="flex flex-col -space-y-1">
                        <ChevronUp
                          size={10}
                          className={
                            sortKey === col.key && sortDir === 'asc' ?'text-primary' :'text-muted-foreground/40'
                          }
                        />
                        <ChevronDown
                          size={10}
                          className={
                            sortKey === col.key && sortDir === 'desc' ?'text-primary' :'text-muted-foreground/40'
                          }
                        />
                      </span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <EmptyState
                    icon={FolderOpen}
                    title="No collateral records found"
                    description="No records match your current filters. Adjust the search or filters above, or register a new collateral item."
                    actionLabel="Register Collateral"
                    onAction={() => {}}
                  />
                </td>
              </tr>
            ) : (
              data.map((item, i) => {
                const isSelected = selectedIds.includes(item.id);
                const isOverdue = item.status === 'Overdue' || (item.daysToDeadline !== null && item.daysToDeadline < 0);
                const isApproaching = item.daysToDeadline !== null && item.daysToDeadline >= 0 && item.daysToDeadline <= 7;

                return (
                  <tr
                    key={`row-${item.id}`}
                    className={`border-b border-border last:border-0 transition-colors group ${
                      isSelected ? 'bg-primary/5' : i % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                    } hover:bg-primary/5`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(item.id)}
                        className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        aria-label={`Select ${item.id}`}
                      />
                    </td>
                    {/* ID */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/collateral-detail/${item.id}`}
                        className="font-mono text-xs font-600 text-primary hover:underline cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.collateralId}
                      </Link>
                    </td>
                    {/* Obligor */}
                    <td className="px-4 py-3 max-w-[160px]">
                      {item.obligorRefId ? (
                        <Link
                          href={`/obligors/${item.obligorRefId}`}
                          className="text-sm font-500 text-primary hover:underline truncate block"
                          title={item.obligor}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.obligor}
                        </Link>
                      ) : (
                        <p className="text-sm font-500 text-foreground truncate">{item.obligor}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono truncate">{item.obligorId}</p>
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                      {item.type}
                    </td>
                    {/* Description */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate" title={item.description}>
                        {item.description}
                      </p>
                    </td>
                    {/* Value */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-600 text-foreground">
                        TSh {item.valueTSh}
                      </span>
                      {/* Financial health inline indicators */}
                      {(item.ltvRatio != null || item.availableEquity != null) && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.ltvRatio != null && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-600 px-1.5 py-0.5 rounded ${
                              item.ltvRatio >= 0.8 ? 'bg-red-100 text-red-700' :
                              item.ltvRatio >= 0.65 ? 'bg-amber-100 text-amber-700': 'bg-green-100 text-green-700'
                            }`}>
                              <TrendingUp size={8} />
                              LTV {Math.round(item.ltvRatio * 100)}%
                            </span>
                          )}
                          {item.availableEquity != null && (
                            <span className={`text-[10px] font-500 px-1.5 py-0.5 rounded ${
                              item.availableEquity <= 0 ? 'bg-red-100 text-red-700' :
                              item.maxSecurableAmount && (item.availableEquity / item.maxSecurableAmount) < 0.2 ? 'bg-amber-100 text-amber-700': 'bg-blue-50 text-blue-700'
                            }`}>
                              Eq: TSh {fmtTShCompact(item.availableEquity)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {/* Facility */}
                    <td className="px-4 py-3">
                      {item.facilityId ? (
                        <Link
                          href={`/loans?facility=${encodeURIComponent(item.facilityId)}`}
                          className="font-mono text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.facilityId}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setStatusDropdown(
                              statusDropdown === item.id ? null : item.id
                            )
                          }
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          aria-label={`Change status for ${item.id}`}
                        >
                          <Badge
                            variant={statusBadgeMap[item.status]}
                            label={item.status}
                          />
                        </button>
                        {statusDropdown === item.id && (
                          <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-border rounded-lg shadow-dropdown min-w-[140px]">
                            {statusOptions.map((s) => (
                              <button
                                key={`status-opt-${item.id}-${s}`}
                                onClick={() => {
                                  onStatusChange(item.id, s);
                                  setStatusDropdown(null);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${
                                  item.status === s ? 'bg-primary/5 font-600 text-primary' : 'text-foreground'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Registry */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-500 ${
                          registryColors[item.registry] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.registry}
                      </span>
                    </td>
                    {/* Deadline */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.perfectionDeadline ? (
                        <div>
                          <p className={`text-xs font-500 ${isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-foreground'}`}>
                            {item.perfectionDeadline}
                          </p>
                          {item.daysToDeadline !== null && (
                            <p className={`text-[10px] flex items-center gap-0.5 ${
                              isOverdue ? 'text-red-500' : isApproaching ? 'text-amber-500' : 'text-muted-foreground'
                            }`}>
                              {isOverdue ? (
                                <><AlertTriangle size={9} />{Math.abs(item.daysToDeadline)}d overdue</>
                              ) : isApproaching ? (
                                <><Clock size={9} />{item.daysToDeadline}d left</>
                              ) : (
                                <>{item.daysToDeadline}d remaining</>
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </td>
                    {/* Officer */}
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {item.assignedOfficer}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative group/btn">
                          <button
                            onClick={() => router.push(`/collateral-detail/${item.id}`)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="View collateral details"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                        <div className="relative group/btn">
                          <button
                            onClick={() => onEdit(item)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Edit collateral record"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}–
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={`pp-${n}`} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-white hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={13} />
            </button>
            {pageNumbers.map((n) => (
              <button
                key={`page-${n}`}
                onClick={() => onPageChange(n)}
                className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-500 transition-colors ${
                  n === currentPage
                    ? 'bg-primary text-white border-primary' :'bg-white border-border hover:bg-muted text-foreground'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded border border-border bg-white hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}