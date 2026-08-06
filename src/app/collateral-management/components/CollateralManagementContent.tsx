'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Plus, Download, Filter, Search, X, FileText, FileDown, ChevronDown, Play, CheckCircle, Clock, AlertTriangle, Eye, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { collateralService, auditService, CollateralRecord, CollateralStatus, CollateralWriteError } from '@/lib/supabase/collateralService';
import { documentService } from '@/lib/supabase/documentService';
import { collateralLookupsService } from '@/lib/supabase/collateralLookupsService';
import { collateralTypeRequiredDocsService } from '@/lib/supabase/collateralTypeRequiredDocsService';
import { useAuth } from '@/contexts/AuthContext';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';
import { userTaskService } from '@/lib/supabase/userTaskService';
import CollateralTable from './CollateralTable';
import CollateralFilters from './CollateralFilters';
import AddEditCollateralModal from './AddEditCollateralModal';
import NextStepsBanner from './NextStepsBanner';
import InitiateWorkflowModal from './InitiateWorkflowModal';
import QuickViewModal from './QuickViewModal';


export interface FilterState {
  search: string;
  type: string;
  status: string;
  registry: string;
  officer: string;
  dateFrom?: string;
  dateTo?: string;
  minValue?: string;
  maxValue?: string;
}

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CollateralRecord | null>(null);
  const [quickViewItem, setQuickViewItem] = useState<CollateralRecord | null>(null);
  const [collateralData, setCollateralData] = useState<CollateralRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [newlyCreated, setNewlyCreated] = useState<CollateralRecord | null>(null);
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [workflowTarget, setWorkflowTarget] = useState<CollateralRecord | null>(null);

  // ─── Column Visibility ──────────────────────────────────────────────────────

  const [visibleColumns, setVisibleColumns] = useState<string[]>([
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

  const allColumns = [
    { id: 'select', label: 'Select' },
    { id: 'collateralId', label: 'Collateral ID' },
    { id: 'obligor', label: 'Obligor' },
    { id: 'type', label: 'Type' },
    { id: 'value', label: 'Value (TSh)' },
    { id: 'facilityId', label: 'Facility ID' },
    { id: 'status', label: 'Status' },
    { id: 'registry', label: 'Registry' },
    { id: 'registrationDate', label: 'Registration Date' },
    { id: 'perfectionDeadline', label: 'Perfection Deadline' },
    { id: 'assignedOfficer', label: 'Assigned Officer' },
    { id: 'documents', label: 'Documents' },
    { id: 'actions', label: 'Actions' },
  ];

  const toggleColumn = (columnId: string) => {
    if (columnId === 'select' || columnId === 'actions') return;
    setVisibleColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  // ─── Live lookup data ──────────────────────────────────────────────────────

  const [filterCollateralTypes, setFilterCollateralTypes] = useState<string[]>([]);
  const [filterRegistries, setFilterRegistries] = useState<string[]>([]);
  const [filterOfficers, setFilterOfficers] = useState<string[]>([]);

  // ─── Doc compliance state ──────────────────────────────────────────────────

  const [docUploadedCounts, setDocUploadedCounts] = useState<Record<string, number>>({});
  const [docRequiredCounts, setDocRequiredCounts] = useState<Record<string, number>>({});

  // ─── Debounced search ──────────────────────────────────────────────────────

  const debouncedSearch = useDebounce(filters.search, 300);

  // ─── Load lookup data ──────────────────────────────────────────────────────

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

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await collateralService.getAll();
      setCollateralData(data);

      const ids = data.map((c) => c.id);
      const [uploadedCounts, requiredGrouped] = await Promise.all([
        documentService.getUploadedDocCountsByCollateralIds(ids),
        collateralTypeRequiredDocsService.getAllGrouped(),
      ]);
      setDocUploadedCounts(uploadedCounts);
      const reqCounts: Record<string, number> = {};
      for (const [typeName, docs] of Object.entries(requiredGrouped)) {
        reqCounts[typeName] = docs.length;
      }
      setDocRequiredCounts(reqCounts);
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

  // ─── Real-time subscription ──────────────────────────────────────────────

  useCollateralRealtime({
    onCollateralChange: () => {
      fetchData();
    },
  });

  // ─── Close menus on outside click ────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N - New collateral
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setAddModalOpen(true);
      }
      // Ctrl/Cmd + F - Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
      // Escape - Close modals
      if (e.key === 'Escape') {
        setAddModalOpen(false);
        setEditItem(null);
        setWorkflowModalOpen(false);
        setQuickViewItem(null);
      }
      // Delete/Backspace - Bulk delete when items selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !(e.target as HTMLElement)?.closest('input')) {
        if (window.confirm(`Delete ${selectedIds.length} selected item(s)?`)) {
          handleBulkDelete();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  // ─── Filtered data ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return collateralData.filter((c) => {
      const matchSearch =
        !debouncedSearch ||
        c.obligor.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.collateralId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.facilityId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.description.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchType = !filters.type || c.type === filters.type;
      const matchStatus = !filters.status || c.status === filters.status;
      const matchRegistry = !filters.registry || c.registry === filters.registry;
      const matchOfficer = !filters.officer || c.assignedOfficer === filters.officer;
      
      // Advanced filters
      const matchDateFrom = !filters.dateFrom || new Date(c.registrationDate) >= new Date(filters.dateFrom);
      const matchDateTo = !filters.dateTo || new Date(c.registrationDate) <= new Date(filters.dateTo);
      const matchMinValue = !filters.minValue || c.valueTSh >= parseFloat(filters.minValue);
      const matchMaxValue = !filters.maxValue || c.valueTSh <= parseFloat(filters.maxValue);
      
      return matchSearch && matchType && matchStatus && matchRegistry && matchOfficer &&
        matchDateFrom && matchDateTo && matchMinValue && matchMaxValue;
    });
  }, [collateralData, debouncedSearch, filters]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ─── Status config ────────────────────────────────────────────────────────

  const statusConfig = {
    Perfected: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
    'Under Review': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
    Overdue: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
    Submitted: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: FileText },
    Released: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: CheckCircle },
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    const ids = [...selectedIds];
    
    // Optimistic update
    setCollateralData(prev => prev.filter(c => !ids.includes(c.id)));
    setSelectedIds([]);
    
    toast.promise(
      collateralService.deleteMany(ids),
      {
        loading: `Deleting ${count} item(s)...`,
        success: () => {
          fetchData();
          return `${count} collateral item(s) removed`;
        },
        error: (err) => {
          setCollateralData(prev => [...prev, ...collateralData.filter(c => ids.includes(c.id))]);
          return err.message || 'Failed to remove selected items';
        }
      }
    );
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

      if (user?.id) {
        try {
          const assignedUserId = user.id;
          const tasks = [
            {
              assignedTo: assignedUserId,
              collateralRecordId: created.id,
              collateralId: created.collateralId,
              taskType: 'document_upload' as const,
              title: `Upload required documents for ${created.collateralId}`,
              description: `Attach all mandatory documents (Title Deed, Valuation Report, etc.) for ${created.obligor} – ${created.type}.`,
              actionUrl: `/collateral-management`,
              actionLabel: 'Upload Docs',
              priority: 'high' as const,
              createdBy: user.id,
            },
            ...(created.requiresPerfection ? [{
              assignedTo: assignedUserId,
              collateralRecordId: created.id,
              collateralId: created.collateralId,
              taskType: 'perfection' as const,
              title: `Submit perfection request for ${created.collateralId}`,
              description: `Perfection deadline: ${created.perfectionDeadline || 'not set'}. Submit the perfection workflow for ${created.obligor}.`,
              actionUrl: '/perfection-workflow',
              actionLabel: 'Start Perfection',
              priority: 'high' as const,
              dueDate: created.perfectionDeadline || undefined,
              createdBy: user.id,
            }] : []),
            {
              assignedTo: assignedUserId,
              collateralRecordId: created.id,
              collateralId: created.collateralId,
              taskType: 'approval' as const,
              title: `Route documents for approval – ${created.collateralId}`,
              description: `After uploading documents, submit them for officer review and approval.`,
              actionUrl: '/document-approval',
              actionLabel: 'Go to Approvals',
              priority: 'normal' as const,
              createdBy: user.id,
            },
            {
              assignedTo: assignedUserId,
              collateralRecordId: created.id,
              collateralId: created.collateralId,
              taskType: 'valuation' as const,
              title: `Schedule valuation for ${created.collateralId}`,
              description: `Initiate a valuation workflow to confirm the market value of ${created.type} for ${created.obligor}.`,
              actionUrl: '/valuation-workflow',
              actionLabel: 'Valuation Workflow',
              priority: 'normal' as const,
              createdBy: user.id,
            },
          ];
          await userTaskService.createMany(tasks);
        } catch {
          // task creation failure is non-blocking
        }
      }

      toast.success('Collateral record created');
      setAddModalOpen(false);
      setNewlyCreated(created);
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

  // ─── Render ──────────────────────────────────────────────────────────────────

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
            onClick={() => {
              setWorkflowTarget(selectedIds.length === 1
                ? (collateralData.find((c) => c.id === selectedIds[0]) ?? null)
                : null);
              setWorkflowModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Play size={14} className="text-primary" />
            <span className="hidden xs:inline">Start Workflow</span>
            <span className="xs:hidden">Workflow</span>
          </button>
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
              ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted'
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
        /* ─── TABLE ─── */
        <CollateralTable
          data={paginated}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          allIds={paginated.map((c) => c.id)} // ← FIX: Added allIds prop
          onEdit={(item) => setEditItem(item)}
          onView={(item) => setQuickViewItem(item)}
          onStatusChange={handleStatusChange}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={(p) => setCurrentPage(p)}
          onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
          docUploadedCounts={docUploadedCounts}
          docRequiredCounts={docRequiredCounts}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
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

      {/* Initiate Workflow Modal */}
      <InitiateWorkflowModal
        open={workflowModalOpen}
        collateral={workflowTarget}
        onClose={() => {
          setWorkflowModalOpen(false);
          setWorkflowTarget(null);
        }}
        onLaunched={() => {
          setWorkflowModalOpen(false);
          setWorkflowTarget(null);
        }}
      />

      {/* Next Steps Banner */}
      {newlyCreated && (
        <NextStepsBanner
          collateral={newlyCreated}
          onDismiss={() => setNewlyCreated(null)}
        />
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        open={!!quickViewItem}
        item={quickViewItem}
        onClose={() => setQuickViewItem(null)}
        onEdit={() => {
          setEditItem(quickViewItem);
          setQuickViewItem(null);
        }}
        docUploadedCounts={docUploadedCounts}
        docRequiredCounts={docRequiredCounts}
      />

      {/* Floating Quick Actions */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40">
        <button
          onClick={() => setAddModalOpen(true)}
          className="p-3 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          aria-label="Add Collateral (⌘N)"
        >
          <Plus size={20} />
        </button>
        {selectedIds.length === 1 && (
          <button
            onClick={() => {
              const item = collateralData.find(c => c.id === selectedIds[0]);
              if (item) setEditItem(item);
            }}
            className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Edit Selected"
          >
            <Edit size={18} />
          </button>
        )}
        {selectedIds.length === 1 && (
          <button
            onClick={() => {
              const item = collateralData.find(c => c.id === selectedIds[0]);
              if (item) setQuickViewItem(item);
            }}
            className="p-3 bg-purple-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            aria-label="Quick View Selected"
          >
            <Eye size={18} />
          </button>
        )}
      </div>
    </div>
  );
}