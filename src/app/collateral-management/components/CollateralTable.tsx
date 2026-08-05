'use client';
import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  TrendingUp,
  FileCheck,
  FileX,
  FileClock,
  ExternalLink,
  Columns,
  CheckCircle,
  FileText,
} from 'lucide-react';
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
  docUploadedCounts?: Record<string, number>;
  docRequiredCounts?: Record<string, number>;
  visibleColumns?: string[];
  onVisibleColumnsChange?: (columns: string[]) => void;
}

const statusBadgeMap: Record<
  CollateralStatus,
  | 'perfected'
  | 'pending'
  | 'overdue'
  | 'draft'
  | 'released'
  | 'monitoring'
  | 'rejected'
  | 'under-review'
  | 'submitted'
> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'under-review',
  Perfected: 'perfected',
  Monitoring: 'monitoring',
  Released: 'released',
  Overdue: 'overdue',
  Rejected: 'rejected',
};

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Perfected: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  'Under Review': { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
  Overdue: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
  Submitted: { color: 'text-blue-700', bg: 'bg-blue-100', icon: FileText },
  Active: { color: 'text-gray-700', bg: 'bg-gray-100', icon: CheckCircle },
  Released: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  Rejected: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
  Monitoring: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Clock },
  Draft: { color: 'text-gray-700', bg: 'bg-gray-100', icon: FileText },
};

const registryColors: Record<string, string> = {
  BRELA: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Lands Registry': 'bg-teal-50 text-teal-700 border border-teal-200',
  TRA: 'bg-purple-50 text-purple-700 border border-purple-200',
  DSE: 'bg-orange-50 text-orange-700 border border-orange-200',
  TASAC: 'bg-pink-50 text-pink-700 border border-pink-200',
  'N/A': 'bg-gray-50 text-gray-500 border border-gray-200',
};

const allColumns = [
  { id: 'select', label: 'Select' },
  { id: 'collateralId', label: 'Collateral ID' },
  { id: 'obligor', label: 'Obligor' },
  { id: 'type', label: 'Type' },
  { id: 'description', label: 'Description' },
  { id: 'value', label: 'Value (TSh)' },
  { id: 'facilityId', label: 'Facility ID' },
  { id: 'status', label: 'Status' },
  { id: 'registry', label: 'Registry' },
  { id: 'perfectionDeadline', label: 'Deadline' },
  { id: 'assignedOfficer', label: 'Officer' },
  { id: 'documents', label: 'Doc Compliance' },
  { id: 'actions', label: 'Actions' },
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
  docUploadedCounts = {},
  docRequiredCounts = {},
  visibleColumns: externalVisibleColumns,
  onVisibleColumnsChange,
}: CollateralTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('collateralId');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Internal state for visible columns if not controlled externally
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<string[]>([
    'select',
    'collateralId',
    'obligor',
    'type',
    'value',
    'status',
    'registry',
    'documents',
    'actions'
  ]);

  // Use external if provided, otherwise use internal
  const visibleColumns = externalVisibleColumns || internalVisibleColumns;

  const updateVisibleColumns = (newColumns: string[]) => {
    if (onVisibleColumnsChange) {
      onVisibleColumnsChange(newColumns);
    } else {
      setInternalVisibleColumns(newColumns);
    }
  };

  const toggleColumn = (columnId: string) => {
    if (columnId === 'select' || columnId === 'actions') return;
    
    let newColumns: string[];
    if (visibleColumns.includes(columnId)) {
      newColumns = visibleColumns.filter(id => id !== columnId);
    } else {
      newColumns = [...visibleColumns, columnId];
    }
    updateVisibleColumns(newColumns);
  };

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
    'Draft',
    'Submitted',
    'Under Review',
    'Perfected',
    'Monitoring',
    'Released',
    'Rejected',
  ];

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages =
    totalPages <= 5
      ? pageNumbers
      : pageNumbers.slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
        <EmptyState
          icon={FolderOpen}
          title="No collateral records found"
          description="No records match your current filters. Adjust the search or filters above, or register a new collateral item."
          actionLabel="Register Collateral"
          onAction={() => {}}
        />
      </div>
    );
  }

  // Helper: render doc compliance cell content
  function DocComplianceCell({ item }: { item: Collateral }) {
    const uploaded = docUploadedCounts[item.id] ?? 0;
    const required = docRequiredCounts[item.type] ?? 0;

    if (required === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <FileClock size={12} />
          No req.
        </span>
      );
    }

    const pct = Math.min(100, Math.round((uploaded / required) * 100));
    const isComplete = uploaded >= required;
    const isMissing = uploaded === 0;

    const barColor = isComplete ? 'bg-green-500' : isMissing ? 'bg-red-400' : 'bg-amber-400';

    const textColor = isComplete ? 'text-green-700' : isMissing ? 'text-red-600' : 'text-amber-700';

    const Icon = isComplete ? FileCheck : isMissing ? FileX : FileClock;

    return (
      <div className="min-w-[100px]">
        <div className={`flex items-center gap-1 mb-1 ${textColor}`}>
          <Icon size={11} />
          <span className="text-[11px] font-600 whitespace-nowrap">
            {uploaded}/{required} docs
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
      {/* ── Mobile card layout ── */}
      <div className="block md:hidden divide-y divide-border">
        {data.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const isOverdue =
            item.status === 'Overdue' || (item.daysToDeadline !== null && item.daysToDeadline < 0);
          const isApproaching =
            item.daysToDeadline !== null && item.daysToDeadline >= 0 && item.daysToDeadline <= 7;

          return (
            <div
              key={`card-${item.id}`}
              className={`p-4 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(item.id)}
                    className="w-4 h-4 rounded border-border accent-primary cursor-pointer shrink-0"
                  />
                  <Link
                    href={`/collateral-detail/${item.id}`}
                    className="font-mono text-xs font-600 text-primary hover:underline"
                  >
                    {item.collateralId}
                  </Link>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quick View */}
                  <button
                    onClick={() => onView(item)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 transition-colors text-muted-foreground hover:text-blue-600"
                    aria-label="Quick View"
                    title="Quick View (preview in modal)"
                  >
                    <Eye size={14} />
                  </button>
                  {/* Full View */}
                  <button
                    onClick={() => router.push(`/collateral-detail/${item.id}`)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-purple-50 transition-colors text-muted-foreground hover:text-purple-600"
                    aria-label="Full View"
                    title="Full View (go to detail page)"
                  >
                    <ExternalLink size={14} />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => onEdit(item)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-amber-50 transition-colors text-muted-foreground hover:text-amber-600"
                    aria-label="Edit"
                    title="Edit Record"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>

              {/* Rest of mobile card... */}
              <div className="mb-2">
                {item.obligorRefId ? (
                  <Link
                    href={`/obligors/${item.obligorRefId}`}
                    className="text-sm font-600 text-primary hover:underline"
                  >
                    {item.obligor}
                  </Link>
                ) : (
                  <p className="text-sm font-600 text-foreground">{item.obligor}</p>
                )}
                <p className="text-xs text-muted-foreground font-mono">{item.obligorId}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Type: </span>
                  <span className="text-foreground font-500">{item.type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Value: </span>
                  <span className="font-mono font-600 text-foreground">TSh {item.valueTSh}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Registry: </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-500 ${registryColors[item.registry] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {item.registry}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Facility: </span>
                  {item.facilityId ? (
                    <Link
                      href={`/loans?facility=${encodeURIComponent(item.facilityId)}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {item.facilityId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {item.perfectionDeadline && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Deadline: </span>
                    <span
                      className={`font-500 ${isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-foreground'}`}
                    >
                      {item.perfectionDeadline}
                    </span>
                    {item.daysToDeadline !== null && (
                      <span
                        className={`ml-1.5 inline-flex items-center gap-0.5 text-[10px] ${isOverdue ? 'text-red-500' : isApproaching ? 'text-amber-500' : 'text-muted-foreground'}`}
                      >
                        {isOverdue ? (
                          <>
                            <AlertTriangle size={9} />
                            {Math.abs(item.daysToDeadline)}d overdue
                          </>
                        ) : isApproaching ? (
                          <>
                            <Clock size={9} />
                            {item.daysToDeadline}d left
                          </>
                        ) : (
                          <>{item.daysToDeadline}d remaining</>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status + Officer */}
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdown(statusDropdown === item.id ? null : item.id)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Badge variant={statusBadgeMap[item.status]} label={item.status} />
                  </button>
                  {statusDropdown === item.id && (
                    <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-border rounded-lg shadow-dropdown min-w-[140px]">
                      {statusOptions.map((s) => (
                        <button
                          key={`status-opt-m-${item.id}-${s}`}
                          onClick={() => {
                            onStatusChange(item.id, s);
                            setStatusDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${item.status === s ? 'bg-primary/5 font-600 text-primary' : 'text-foreground'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{item.assignedOfficer}</span>
              </div>
              {/* Doc Compliance (mobile) */}
              <div className="mt-2.5 pt-2.5 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase font-600 mb-1">
                  Doc Compliance
                </p>
                <DocComplianceCell item={item} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table layout ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              {/* Column Visibility Button */}
              <th className="px-4 py-3 w-10">
                <div className="relative">
                  <button
                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Toggle columns"
                  >
                    <Columns size={16} className="text-muted-foreground" />
                  </button>
                  {showColumnMenu && (
                    <div className="absolute z-30 top-full mt-1 left-0 bg-white border border-border rounded-lg shadow-lg min-w-[180px] p-2">
                      {allColumns.map((col) => (
                        <label
                          key={col.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer hover:bg-muted transition-colors ${
                            (col.id === 'select' || col.id === 'actions') ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.id)}
                            onChange={() => toggleColumn(col.id)}
                            disabled={col.id === 'select' || col.id === 'actions'}
                            className="rounded border-border text-primary focus:ring-primary/30"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </th>
              {allColumns.map((col) => {
                if (!visibleColumns.includes(col.id)) return null;
                if (col.id === 'select') return null; // Already handled above
                return (
                  <th
                    key={`th-${col.id}`}
                    className={`px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                      col.id !== 'actions' && col.id !== 'select' ? 'cursor-pointer hover:text-foreground select-none' : ''
                    } ${sortKey === col.id ? 'text-primary' : ''}`}
                    onClick={() => col.id !== 'actions' && col.id !== 'select' && handleSort(col.id)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.id !== 'actions' && col.id !== 'select' && (
                        <span className="flex flex-col -space-y-1">
                          <ChevronUp
                            size={10}
                            className={
                              sortKey === col.id && sortDir === 'asc'
                                ? 'text-primary'
                                : 'text-muted-foreground/40'
                            }
                          />
                          <ChevronDown
                            size={10}
                            className={
                              sortKey === col.id && sortDir === 'desc'
                                ? 'text-primary'
                                : 'text-muted-foreground/40'
                            }
                          />
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => {
              const isSelected = selectedIds.includes(item.id);
              const isOverdue =
                item.status === 'Overdue' ||
                (item.daysToDeadline !== null && item.daysToDeadline < 0);
              const isApproaching =
                item.daysToDeadline !== null &&
                item.daysToDeadline >= 0 &&
                item.daysToDeadline <= 7;

              return (
                <tr
                  key={`row-${item.id}`}
                  className={`border-b border-border last:border-0 transition-colors ${
                    isSelected ? 'bg-primary/5' : i % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                  } hover:bg-primary/5`}
                >
                  {/* Select Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(item.id)}
                      className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
                      aria-label={`Select ${item.id}`}
                    />
                  </td>
                  
                  {/* Collateral ID */}
                  {visibleColumns.includes('collateralId') && (
                    <td className="px-4 py-3">
                      <Link
                        href={`/collateral-detail/${item.id}`}
                        className="font-mono text-xs font-600 text-primary hover:underline cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.collateralId}
                      </Link>
                    </td>
                  )}
                  
                  {/* Obligor */}
                  {visibleColumns.includes('obligor') && (
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
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {item.obligorId}
                      </p>
                    </td>
                  )}
                  
                  {/* Type */}
                  {visibleColumns.includes('type') && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                      {item.type}
                    </td>
                  )}
                  
                  {/* Description */}
                  {visibleColumns.includes('description') && (
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate" title={item.description}>
                        {item.description || '—'}
                      </p>
                    </td>
                  )}
                  
                  {/* Value */}
                  {visibleColumns.includes('value') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-600 text-foreground">
                        TSh {item.valueTSh}
                      </span>
                    </td>
                  )}
                  
                  {/* Facility ID */}
                  {visibleColumns.includes('facilityId') && (
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
                  )}
                  
                  {/* Status */}
                  {visibleColumns.includes('status') && (
                    <td className="px-4 py-3">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setStatusDropdown(statusDropdown === item.id ? null : item.id)
                          }
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                          aria-label={`Change status for ${item.id}`}
                        >
                          <Badge variant={statusBadgeMap[item.status]} label={item.status} />
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
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg ${item.status === s ? 'bg-primary/5 font-600 text-primary' : 'text-foreground'}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* Registry */}
                  {visibleColumns.includes('registry') && (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-500 ${registryColors[item.registry] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {item.registry}
                      </span>
                    </td>
                  )}
                  
                  {/* Perfection Deadline */}
                  {visibleColumns.includes('perfectionDeadline') && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.perfectionDeadline ? (
                        <div>
                          <p
                            className={`text-xs font-500 ${isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-foreground'}`}
                          >
                            {item.perfectionDeadline}
                          </p>
                          {item.daysToDeadline !== null && (
                            <p
                              className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500' : isApproaching ? 'text-amber-500' : 'text-muted-foreground'}`}
                            >
                              {isOverdue ? (
                                <>
                                  <AlertTriangle size={9} />
                                  {Math.abs(item.daysToDeadline)}d overdue
                                </>
                              ) : isApproaching ? (
                                <>
                                  <Clock size={9} />
                                  {item.daysToDeadline}d left
                                </>
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
                  )}
                  
                  {/* Assigned Officer */}
                  {visibleColumns.includes('assignedOfficer') && (
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {item.assignedOfficer || '—'}
                    </td>
                  )}
                  
                  {/* Documents */}
                  {visibleColumns.includes('documents') && (
                    <td className="px-4 py-3">
                      <DocComplianceCell item={item} />
                    </td>
                  )}
                  
                  {/* Actions */}
                  {visibleColumns.includes('actions') && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onView(item)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 transition-colors text-muted-foreground hover:text-blue-600"
                          aria-label="Quick View"
                          title="Quick View (preview in modal)"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => router.push(`/collateral-detail/${item.id}`)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-purple-50 transition-colors text-muted-foreground hover:text-purple-600"
                          aria-label="Full View"
                          title="Full View (go to detail page)"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => onEdit(item)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-amber-50 transition-colors text-muted-foreground hover:text-amber-600"
                          aria-label="Edit"
                          title="Edit Record"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)}–
              {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 border border-border rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={`pp-${n}`} value={n}>
                    {n}
                  </option>
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
            {visiblePages.map((n) => (
              <button
                key={`page-${n}`}
                onClick={() => onPageChange(n)}
                className={`w-7 h-7 flex items-center justify-center rounded border text-xs font-500 transition-colors ${
                  n === currentPage
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white border-border hover:bg-muted text-foreground'
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