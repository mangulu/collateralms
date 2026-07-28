'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, Download, Filter, Search, X, FileText, FileDown, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { collateralService, auditService, CollateralRecord, CollateralStatus, CollateralWriteError } from '@/lib/supabase/collateralService';
import { documentService } from '@/lib/supabase/documentService';
import { collateralLookupsService } from '@/lib/supabase/collateralLookupsService';
import { useAuth } from '@/contexts/AuthContext';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';
import CollateralTable from './CollateralTable';
import CollateralFilters from './CollateralFilters';
import AddEditCollateralModal from './AddEditCollateralModal';

export interface FilterState {
  search: string;
  type: string;
  status: string;
  registry: string;
  officer: string;
}

// Re-export Collateral type alias for backward compatibility
// Remove this block or line ...

export default function CollateralManagementContent() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    type: '',
    status: '',
    registry: '',
    officer: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CollateralRecord | null>(null);
  const [collateralData, setCollateralData] = useState<CollateralRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Live lookup data for filter dropdowns
  const [filterCollateralTypes, setFilterCollateralTypes] = useState<string[]>([]);
  const [filterRegistries, setFilterRegistries] = useState<string[]>([]);
  const [filterOfficers, setFilterOfficers] = useState<string[]>([]);

  // Load lookup data once on mount
  useEffect(() => {
    Promise.all([
      collateralLookupsService.getCollateralTypeNames(),
      collateralLookupsService.getRegistryNames(),
      collateralLookupsService.getOfficerNames(),
    ]).then(([types, regs, officers]) => {
      setFilterCollateralTypes(types);
      setFilterRegistries(regs);
      setFilterOfficers(officers);
    }).catch(() => {
      // Fallbacks handled inside service
    });
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await collateralService.getAll();
      setCollateralData(data);
    } catch (err: any) {
      toast.error('Failed to load collateral records');
      setFetchError('Unable to load collateral records. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription: silently refresh when any collateral row changes
  useCollateralRealtime({
    onCollateralChange: () => {
      fetchData();
    },
  });

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    return collateralData.filter((c) => {
      const matchSearch =
        !filters.search ||
        c.obligor.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.collateralId.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.facilityId.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.description.toLowerCase().includes(filters.search.toLowerCase());
      const matchType = !filters.type || c.type === filters.type;
      const matchStatus = !filters.status || c.status === filters.status;
      const matchRegistry = !filters.registry || c.registry === filters.registry;
      const matchOfficer = !filters.officer || c.assignedOfficer === filters.officer;
      return matchSearch && matchType && matchStatus && matchRegistry && matchOfficer;
    });
  }, [collateralData, filters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    try {
      await collateralService.deleteMany(selectedIds);
      toast.success(`${count} collateral item(s) removed`);
      setSelectedIds([]);
      fetchData();
    } catch {
      toast.error('Failed to remove selected items');
    }
  };

  const handleStatusChange = async (id: string, status: CollateralStatus) => {
    try {
      await collateralService.updateStatus(id, status);
      const record = collateralData.find((c) => c.id === id);
      if (record) {
        await auditService.log({
          collateralRecordId: id,
          collateralId: record.collateralId,
          action: 'status_changed',
          message: `Status updated to ${status} for ${record.collateralId}`,
          detail: `${record.obligor} · ${record.type}`,
          performedBy: user?.id,
          performedByName: user?.email ?? '',
        });
      }
      toast.success(`Status updated to ${status}`);
      fetchData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSave = async (data: Partial<CollateralRecord>, pendingFiles?: { file: File; docType: string; notes: string }[]) => {
    if (editItem) {
      let updated: CollateralRecord;
      try {
        updated = await collateralService.update(editItem.id, data);
      } catch (err: any) {
        const userMsg = err?.userMessage ?? err?.message ?? 'Update failed. Please try again.';
        if (err instanceof CollateralWriteError && err.kind !== 'network' && err.kind !== 'unknown') {
          toast.error(userMsg);
        } else {
          toast.error('Failed to update collateral record');
        }
        throw err;
      }

      try {
        await auditService.log({
          collateralRecordId: editItem.id,
          collateralId: editItem.collateralId,
          action: 'updated',
          message: `Collateral ${editItem.collateralId} updated`,
          detail: `${editItem.obligor} · ${editItem.type}`,
          performedBy: user?.id,
          performedByName: user?.email ?? '',
        });
      } catch {
        // audit log failure is non-blocking
      }

      toast.success('Collateral record updated');
      setEditItem(null);
      fetchData();
    } else {
      let created: CollateralRecord;
      try {
        created = await collateralService.create(data, user?.id ?? '');
      } catch (err: any) {
        const userMsg = err?.userMessage ?? err?.message ?? 'Failed to create record. Please try again.';
        if (err instanceof CollateralWriteError && err.kind !== 'network' && err.kind !== 'unknown') {
          toast.error(userMsg);
        } else {
          toast.error('Failed to create collateral record');
        }
        throw err;
      }

      // Upload any pending files now that we have the record ID
      if (pendingFiles && pendingFiles.length > 0 && user) {
        const userName = user.email || 'Unknown';
        try {
          await Promise.all(
            pendingFiles.map((pf) =>
              documentService.upload(
                pf.file,
                created.id,
                created.collateralId,
                pf.docType as any,
                pf.notes,
                user.id,
                userName
              )
            )
          );
        } catch {
          // document upload failure is non-blocking — record was created
          toast.error('Collateral created, but some documents failed to upload. Please retry uploading from the edit view.');
        }
      }

      try {
        await auditService.log({
          collateralRecordId: created.id,
          collateralId: created.collateralId,
          action: 'created',
          message: `New collateral registered: ${created.collateralId}`,
          detail: `${created.obligor} · ${created.type} · TSh ${created.valueTSh}`,
          performedBy: user?.id,
          performedByName: user?.email ?? '',
        });
      } catch {
        // audit log failure is non-blocking
      }

      toast.success('Collateral record created');
      setAddModalOpen(false);
      fetchData();
    }
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== 'search' && v !== ''
  ).length;

  function exportRegistryCSV() {
    const headers = ['Collateral ID', 'Obligor', 'Obligor ID', 'Type', 'Description', 'Value (TSh)', 'Facility ID', 'Status', 'Registry', 'Registration Date', 'Perfection Deadline', 'Days to Deadline', 'Assigned Officer'];
    const rows = filtered.map((c) => [
      c.collateralId,
      c.obligor,
      c.obligorId,
      c.type,
      c.description,
      c.valueTSh,
      c.facilityId,
      c.status,
      c.registry,
      c.registrationDate,
      c.perfectionDeadline,
      c.daysToDeadline ?? '',
      c.assignedOfficer,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collateral_registry_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  }

  async function exportRegistryPDF() {
    setIsExportingPdf(true);
    setExportMenuOpen(false);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'collateral_registry',
          dateFrom: '',
          dateTo: today,
          registries: filters.registry ? [filters.registry] : [],
          statuses: filters.status ? [filters.status] : [],
          collateralTypes: filters.type ? [filters.type] : [],
          includeCharts: false,
          includeSummary: true,
          includeDetails: true,
          stakeholderMode: false,
        }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collateral_registry_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-700 text-foreground">Collateral Registry</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {collateralData.length} total records · {filtered.length} shown ·{' '}
            {collateralData.filter((c) => c.status === 'Overdue').length} overdue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={filtered.length === 0 || isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {isExportingPdf ? 'Generating…' : 'Export'}
              <ChevronDown size={12} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={exportRegistryCSV}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <FileText size={14} className="text-green-600" />
                  Export CSV
                </button>
                <button
                  onClick={exportRegistryPDF}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                >
                  <FileDown size={14} className="text-red-500" />
                  Export PDF
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span className="hidden xs:inline">Register Collateral</span>
            <span className="xs:hidden">Register</span>
          </button>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search by obligor, ID, or description..."
            value={filters.search}
            onChange={(e) => {
              setFilters((f) => ({ ...f, search: e.target.value }));
              setCurrentPage(1);
            }}
            className="w-full pl-8 pr-4 py-2 border border-border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/40 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => setFilters((f) => ({ ...f, search: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm font-500 transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-primary/10 border-primary/30 text-primary' :'bg-white border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full font-600">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <CollateralFilters
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setCurrentPage(1);
          }}
          onClear={() => {
            setFilters({ search: filters.search, type: '', status: '', registry: '', officer: '' });
            setCurrentPage(1);
          }}
          collateralTypes={filterCollateralTypes}
          registries={filterRegistries}
          officers={filterOfficers}
        />
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="slide-up flex items-center justify-between bg-primary text-white px-4 py-2.5 rounded-lg mb-3">
          <span className="text-sm font-500">
            {selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Assign officer — bulk update dialog coming')}
              className="px-3 py-1.5 text-xs font-500 bg-white/20 hover:bg-white/30 rounded transition-colors hidden sm:block"
            >
              Assign Officer
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-xs font-500 bg-red-500 hover:bg-red-600 rounded transition-colors"
            >
              Remove
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-muted-foreground">Loading collateral records...</p>
          </div>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <X size={24} className="text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">Failed to load records</p>
            <p className="text-sm text-muted-foreground mt-1">{fetchError}</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-500 hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Filter size={22} className="text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">No records found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {collateralData.length === 0
                ? 'No collateral records have been registered yet.' :'No records match your current filters. Try adjusting your search or filters.'}
            </p>
          </div>
          {collateralData.length > 0 && (
            <button
              onClick={() => {
                setFilters({ search: '', type: '', status: '', registry: '', officer: '' });
                setCurrentPage(1);
              }}
              className="text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        /* Table */
        <CollateralTable
          data={paginated}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          allIds={filtered.map((c) => c.id)}
          onEdit={(item) => setEditItem(item)}
          onView={() => {}}
          onStatusChange={handleStatusChange}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Add/Edit Modal */}
      <AddEditCollateralModal
        open={addModalOpen || editItem !== null}
        editItem={editItem}
        onClose={() => {
          setAddModalOpen(false);
          setEditItem(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}