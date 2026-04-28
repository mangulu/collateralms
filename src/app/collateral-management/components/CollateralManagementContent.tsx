'use client';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Download, Filter, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { collateralService, auditService, CollateralRecord, CollateralStatus } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import CollateralTable from './CollateralTable';
import CollateralFilters from './CollateralFilters';
import AddEditCollateralModal from './AddEditCollateralModal';
import CollateralDetailModal from './CollateralDetailModal';

export interface FilterState {
  search: string;
  type: string;
  status: string;
  registry: string;
  officer: string;
}

// Re-export Collateral type alias for backward compatibility
export type { CollateralRecord as Collateral } from '@/lib/supabase/collateralService';

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
  const [detailItem, setDetailItem] = useState<CollateralRecord | null>(null);
  const [collateralData, setCollateralData] = useState<CollateralRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  const handleSave = async (data: Partial<CollateralRecord>) => {
    try {
      if (editItem) {
        const updated = await collateralService.update(editItem.id, data);
        if (updated) {
          await auditService.log({
            collateralRecordId: editItem.id,
            collateralId: editItem.collateralId,
            action: 'updated',
            message: `Collateral ${editItem.collateralId} updated`,
            detail: `${editItem.obligor} · ${editItem.type}`,
            performedBy: user?.id,
            performedByName: user?.email ?? '',
          });
          toast.success('Collateral record updated');
          setEditItem(null);
          fetchData();
        }
      } else {
        const created = await collateralService.create(data, user?.id ?? '');
        if (created) {
          await auditService.log({
            collateralRecordId: created.id,
            collateralId: created.collateralId,
            action: 'created',
            message: `New collateral registered: ${created.collateralId}`,
            detail: `${created.obligor} · ${created.type} · TSh ${created.valueTSh}`,
            performedBy: user?.id,
            performedByName: user?.email ?? '',
          });
          toast.success('Collateral record created');
          setAddModalOpen(false);
          fetchData();
        }
      }
    } catch {
      toast.error('Failed to save collateral record');
    }
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => k !== 'search' && v !== ''
  ).length;

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Collateral Registry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {collateralData.length} total records · {filtered.length} shown ·{' '}
            {collateralData.filter((c) => c.status === 'Overdue').length} overdue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('Export CSV — generating report...')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus size={14} />
            Register Collateral
          </button>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search by obligor, collateral ID, facility ID, or description..."
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
              className="px-3 py-1.5 text-xs font-500 bg-white/20 hover:bg-white/30 rounded transition-colors"
            >
              Assign Officer
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-xs font-500 bg-red-500 hover:bg-red-600 rounded transition-colors"
            >
              Remove Selected
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
          onView={(item) => setDetailItem(item)}
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

      {/* Detail Modal */}
      <CollateralDetailModal
        open={detailItem !== null}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={(item) => {
          setDetailItem(null);
          setEditItem(item);
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}