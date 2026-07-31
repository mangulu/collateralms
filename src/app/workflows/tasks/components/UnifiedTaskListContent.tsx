'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, GitBranch, ShieldCheck, RefreshCw, ChevronRight, Loader2, CheckCheck, Search } from 'lucide-react';
import { userTaskService, UserTask } from '@/lib/supabase/userTaskService';
import { collateralApprovalService, CollateralApprovalRequest } from '@/lib/supabase/collateralApprovalService';
import { perfectionService, PerfectionRequest } from '@/lib/supabase/perfectionService';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemCategory = 'task' | 'approval' | 'perfection';
type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal' | 'low';

interface UnifiedItem {
  id: string;
  category: ItemCategory;
  title: string;
  subtitle: string;
  type: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt?: string | null;
  actionUrl?: string;
  raw: UserTask | CollateralApprovalRequest | PerfectionRequest;
}

// ── Meta configs ───────────────────────────────────────────────────────────────

const CATEGORY_META: Record<ItemCategory, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  task:       { label: 'My Task',    icon: <CheckSquare size={13} />,  color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  approval:   { label: 'Approval',   icon: <ShieldCheck size={13} />,  color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  perfection: { label: 'Perfection', icon: <GitBranch size={13} />,    color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
};

const PRIORITY_META: Record<string, { label: string; dot: string; cls: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-red-500',    cls: 'bg-red-50 text-red-700 border-red-200' },
  high:   { label: 'High',   dot: 'bg-orange-400', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  High:   { label: 'High',   dot: 'bg-orange-400', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  normal: { label: 'Normal', dot: 'bg-blue-400',   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  Normal: { label: 'Normal', dot: 'bg-blue-400',   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  low:    { label: 'Low',    dot: 'bg-slate-300',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  Low:    { label: 'Low',    dot: 'bg-slate-300',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  pending:       { color: 'text-amber-700',  bg: 'bg-amber-50' },
  in_progress:   { color: 'text-blue-700',   bg: 'bg-blue-50' },
  completed:     { color: 'text-green-700',  bg: 'bg-green-50' },
  Pending:       { color: 'text-amber-700',  bg: 'bg-amber-50' },
  'Under Review':{ color: 'text-blue-700',   bg: 'bg-blue-50' },
  Approved:      { color: 'text-green-700',  bg: 'bg-green-50' },
  Rejected:      { color: 'text-red-700',    bg: 'bg-red-50' },
  Submitted:     { color: 'text-indigo-700', bg: 'bg-indigo-50' },
};

function CheckSquare({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Item Card ──────────────────────────────────────────────────────────────────

function ItemCard({ item, onMarkComplete }: { item: UnifiedItem; onMarkComplete?: (id: string) => void }) {
  const catMeta = CATEGORY_META[item.category];
  const priMeta = PRIORITY_META[item.priority] ?? PRIORITY_META['normal'];
  const statusMeta = STATUS_META[item.status] ?? { color: 'text-gray-600', bg: 'bg-gray-50' };

  return (
    <div className="group bg-white border border-border rounded-xl p-4 hover:shadow-sm hover:border-indigo-200 transition-all">
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className="mt-1.5 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${priMeta.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-600 border ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}>
                {catMeta.icon} {catMeta.label}
              </span>
              <span className="text-xs text-muted-foreground">{item.type}</span>
            </div>
            <span className={`shrink-0 text-[10px] font-600 px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
              {item.status}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-600 text-foreground leading-snug mb-0.5">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.subtitle}</p>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {item.dueDate && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Due {fmtDate(item.dueDate)}
                </span>
              )}
              {item.createdAt && (
                <span>{timeAgo(item.createdAt)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {item.category === 'task' && item.status !== 'completed' && onMarkComplete && (
                <button
                  onClick={(e) => { e.preventDefault(); onMarkComplete(item.id); }}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-500 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                >
                  <CheckCircle2 size={11} />
                  Done
                </button>
              )}
              <Link
                href={`/workflows/tasks/${item.id}`}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
              >
                View <ChevronRight size={11} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UnifiedTaskListContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  const loadAll = useCallback(async () => {
    setLoading(true);
    const unified: UnifiedItem[] = [];

    await Promise.allSettled([
      // User tasks
      user?.id ? userTaskService.getMyTasks(user.id).then((tasks) => {
        tasks.forEach((t) => {
          unified.push({
            id: t.id,
            category: 'task',
            title: t.title,
            subtitle: t.description ?? '',
            type: t.taskType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            status: t.taskStatus,
            priority: t.priority,
            dueDate: t.dueDate,
            createdAt: t.createdAt,
            actionUrl: t.actionUrl ?? undefined,
            raw: t,
          });
        });
      }).catch(() => {}) : Promise.resolve(),

      // Approval requests
      collateralApprovalService.getAll().then((approvals) => {
        approvals.forEach((a) => {
          unified.push({
            id: a.id,
            category: 'approval',
            title: `${a.requestType} — ${a.collateralId}`,
            subtitle: `${a.obligorName ?? ''} · ${a.facilityId ?? ''}`,
            type: a.requestType,
            status: a.status,
            priority: a.priority,
            dueDate: a.dueDate,
            createdAt: a.createdAt,
            actionUrl: '/approvals',
            raw: a,
          });
        });
      }).catch(() => {}),

      // Perfection requests
      perfectionService.getAll().then((perfs) => {
        perfs.forEach((p) => {
          unified.push({
            id: p.id,
            category: 'perfection',
            title: `Perfection — ${p.collateralId}`,
            subtitle: `${p.obligorName ?? ''} · ${p.requestType ?? ''}`,
            type: 'Perfection Request',
            status: p.status,
            priority: p.priority ?? 'Normal',
            dueDate: p.perfectionDeadline,
            createdAt: p.submittedAt,
            actionUrl: '/approval-inbox',
            raw: p,
          });
        });
      }).catch(() => {}),
    ]);

    setItems(unified);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleMarkComplete = async (id: string) => {
    try {
      await userTaskService.markComplete(id);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'completed' } : i));
    } catch { /* silent */ }
  };

  const filtered = items.filter((item) => {
    if (statusFilter === 'active') {
      const inactive = ['completed', 'Approved', 'Rejected', 'Perfected'];
      if (inactive.includes(item.status)) return false;
    }
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (priorityFilter !== 'all') {
      const p = item.priority.toLowerCase();
      if (p !== priorityFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.subtitle.toLowerCase().includes(q) && !item.type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: items.filter((i) => statusFilter === 'active' ? !['completed', 'Approved', 'Rejected', 'Perfected'].includes(i.status) : true).length,
    task: items.filter((i) => i.category === 'task' && (statusFilter === 'active' ? !['completed'].includes(i.status) : true)).length,
    approval: items.filter((i) => i.category === 'approval' && (statusFilter === 'active' ? !['Approved', 'Rejected'].includes(i.status) : true)).length,
    perfection: items.filter((i) => i.category === 'perfection' && (statusFilter === 'active' ? !['Approved', 'Rejected', 'Perfected'].includes(i.status) : true)).length,
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Workflows
            </Link>
            <ChevronRight size={12} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-500">Task List</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-700 text-foreground">Unified Task List</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            All assigned tasks, approvals, and workflow items in one place
          </p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'All Active', count: counts.all, color: 'text-foreground' },
          { label: 'My Tasks', count: counts.task, color: 'text-teal-600' },
          { label: 'Approvals', count: counts.approval, color: 'text-indigo-600' },
          { label: 'Perfection', count: counts.perfection, color: 'text-violet-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-700 ${kpi.color}`}>{loading ? '—' : kpi.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Active/All toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-white">
            {(['active', 'all'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={`px-3 py-1.5 text-xs font-500 transition-colors ${statusFilter === v ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                {v === 'active' ? 'Active' : 'All'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          {(['all', 'task', 'approval', 'perfection'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-500 border transition-colors ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white border-indigo-600' :'bg-white border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat === 'all' ? 'All Types' : CATEGORY_META[cat].label + 's'}
            </button>
          ))}

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="px-3 py-1.5 rounded-lg text-xs border border-border bg-white text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-500" />
            <p className="text-sm text-muted-foreground">Loading your workflow items…</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCheck size={24} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">
              {search || categoryFilter !== 'all' || priorityFilter !== 'all' ? 'No items match your filters' : 'No active items'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || categoryFilter !== 'all' || priorityFilter !== 'all' ?'Try adjusting your filters to see more items.' :'All tasks and approvals are up to date.'}
            </p>
          </div>
          {(search || categoryFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setCategoryFilter('all'); setPriorityFilter('all'); }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <ItemCard
              key={`${item.category}-${item.id}`}
              item={item}
              onMarkComplete={item.category === 'task' ? handleMarkComplete : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
