'use client';
import React, { useState, useMemo } from 'react';
import { Plus, Download, Filter, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { mockCollateral, Collateral, CollateralStatus } from './collateralData';
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

export default function CollateralManagementContent() {
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
  const [editItem, setEditItem] = useState<Collateral | null>(null);
  const [detailItem, setDetailItem] = useState<Collateral | null>(null);
  const [collateralData, setCollateralData] = useState<Collateral[]>(mockCollateral);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const filtered = useMemo(() => {
    return collateralData.filter((c) => {
      const matchSearch =
        !filters.search ||
        c.obligor.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.id.toLowerCase().includes(filters.search.toLowerCase()) ||
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

  const handleBulkDelete = () => {
    setCollateralData((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
    toast.success(`${selectedIds.length} collateral item(s) removed`);
    setSelectedIds([]);
  };

  const handleStatusChange = (id: string, status: CollateralStatus) => {
    setCollateralData((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    toast.success(`Status updated to ${status}`);
  };

  const handleSave = (data: Partial<Collateral>) => {
    if (editItem) {
      // Backend integration point: PUT /api/collateral/:id
      setCollateralData((prev) =>
        prev.map((c) => (c.id === editItem.id ? { ...c, ...data } : c))
      );
      toast.success('Collateral record updated');
      setEditItem(null);
    } else {
      // Backend integration point: POST /api/collateral
      const newId = `col-${String(collateralData.length + 313).padStart(4, '0')}`;
      setCollateralData((prev) => [
        { ...data, id: newId, status: 'Draft', daysToDeadline: 42 } as Collateral,
        ...prev,
      ]);
      toast.success('Collateral record created');
      setAddModalOpen(false);
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

      {/* Table */}
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
      />
    </div>
  );
}