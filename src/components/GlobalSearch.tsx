'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, FileText, FolderOpen, ScrollText, Users, ChevronRight, Loader2,
  LayoutDashboard, Activity, GitMerge, Files, Unlock, Upload, CalendarClock,
  TrendingUp, LineChart, Target, ShieldAlert, ScanSearch, Zap, Map, Flame,
  Bell, Inbox, AlarmClock, SendHorizonal, BarChart2, Download, DatabaseZap,
  ClipboardList, BookOpen, Scale, ShieldCheck, Radio, KeyRound, Settings,
  Landmark, Building2, MapPin, Library, ClipboardCheck, Eye, FileStack,
  MailCheck, GitBranch, BadgeCheck, Brain, SlidersHorizontal, FolderArchive,
  LayoutGrid, Sparkles, ArrowRight, Hash,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavResult {
  id: string;
  kind: 'screen' | 'quick-action';
  module: string;
  moduleId: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
}

interface DbResult {
  id: string;
  kind: 'db';
  type: 'collateral' | 'document' | 'audit' | 'user';
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  badgeColor?: string;
}

type AnyResult = NavResult | DbResult;

// ─── Static search index: all 9 modules ──────────────────────────────────────

const NAV_INDEX: NavResult[] = [
  // ── Collaterals ──
  { id: 'n-col-dash', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Dashboard', description: 'Collateral portfolio overview & KPIs', href: '/collateral-dashboard', icon: LayoutDashboard, keywords: ['kpi', 'overview', 'portfolio', 'health'] },
  { id: 'n-col-port', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Portfolio Monitoring', description: 'Monitor collateral portfolio in real time', href: '/portfolio-monitoring', icon: Activity, keywords: ['monitor', 'realtime', 'portfolio'] },
  { id: 'n-col-reg', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Collateral Registry', description: 'Browse and manage all collateral records', href: '/collateral-management', icon: FolderOpen, keywords: ['registry', 'records', 'manage', 'list'] },
  { id: 'n-col-map', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Loan–Collateral Map', description: 'Visualise loan-to-collateral relationships', href: '/collateral-loan-visualization', icon: GitMerge, keywords: ['loan', 'map', 'link', 'visualize'] },
  { id: 'n-col-docs', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Collateral Documents', description: 'Manage documents attached to collaterals', href: '/collateral-documents', icon: Files, keywords: ['documents', 'files', 'attachments'] },
  { id: 'n-col-batch', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Batch Release', description: 'Release multiple collaterals at once', href: '/batch-release', icon: Unlock, keywords: ['batch', 'release', 'bulk'] },
  { id: 'n-col-bulk', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Bulk Upload', description: 'Import collateral records via CSV/Excel', href: '/bulk-upload', icon: Upload, keywords: ['import', 'csv', 'excel', 'upload'] },
  { id: 'n-col-jobs', kind: 'screen', module: 'Collaterals', moduleId: 'collaterals', label: 'Scheduled Jobs', description: 'Automate recurring collateral tasks', href: '/scheduled-jobs', icon: CalendarClock, keywords: ['jobs', 'schedule', 'automation', 'cron'] },

  // ── Obligors ──
  { id: 'n-obl-list', kind: 'screen', module: 'Obligors', moduleId: 'obligors', label: 'Obligors', description: 'View and manage all obligor profiles', href: '/obligors', icon: Users, keywords: ['obligor', 'borrower', 'client', 'profile'] },

  // ── Approvals ──
  { id: 'n-app-inbox', kind: 'screen', module: 'Approvals', moduleId: 'approvals', label: 'Approval Inbox', description: 'All pending approval requests in one place', href: '/approval-inbox', icon: MailCheck, keywords: ['inbox', 'pending', 'queue', 'review'] },
  { id: 'n-app-perf', kind: 'screen', module: 'Approvals', moduleId: 'approvals', label: 'Perfection Approval', description: 'Review and approve perfection workflows', href: '/perfection-workflow', icon: GitBranch, keywords: ['perfection', 'workflow', 'approve'] },
  { id: 'n-app-doc', kind: 'screen', module: 'Approvals', moduleId: 'approvals', label: 'Document Approval', description: 'Approve or reject submitted documents', href: '/document-approval', icon: BadgeCheck, keywords: ['document', 'approve', 'reject', 'review'] },
  { id: 'n-app-rel', kind: 'screen', module: 'Approvals', moduleId: 'approvals', label: 'Release Approval', description: 'Approve collateral release requests', href: '/release-approval', icon: Unlock, keywords: ['release', 'approve', 'discharge'] },

  // ── Intelligence ──
  { id: 'n-int-exec', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Executive Dashboard', description: 'High-level analytics for leadership', href: '/executive-dashboard', icon: TrendingUp, keywords: ['executive', 'analytics', 'leadership', 'summary'] },
  { id: 'n-int-cohort', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Cohort Analytics', description: 'Analyse collateral cohorts and trends', href: '/cohort-analytics', icon: LineChart, keywords: ['cohort', 'analytics', 'trend', 'analysis'] },
  { id: 'n-int-dead', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Deadline Predictions', description: 'AI-powered deadline forecasting', href: '/deadline-predictions', icon: Target, keywords: ['deadline', 'predict', 'forecast', 'ai'] },
  { id: 'n-int-fraud', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'AI Fraud Prevention', description: 'Detect and flag suspicious collateral activity', href: '/fraud-prevention', icon: ShieldAlert, keywords: ['fraud', 'detect', 'suspicious', 'ai', 'risk'] },
  { id: 'n-int-risk', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'AI Risk Assessment', description: 'Automated risk scoring for collaterals', href: '/risk-assessment', icon: ScanSearch, keywords: ['risk', 'score', 'assessment', 'ai'] },
  { id: 'n-int-fast', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Fast Track', description: 'Expedite low-risk collateral processing', href: '/fast-track', icon: Zap, keywords: ['fast', 'track', 'expedite', 'quick'] },
  { id: 'n-int-geo', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Geomapping', description: 'Map collateral locations geographically', href: '/geomapping', icon: Map, keywords: ['geo', 'map', 'location', 'geography'] },
  { id: 'n-int-heat', kind: 'screen', module: 'Intelligence', moduleId: 'intelligence', label: 'Portfolio Heatmap', description: 'Visual risk concentration heatmap', href: '/portfolio-heatmap', icon: Flame, keywords: ['heatmap', 'heat', 'concentration', 'risk'] },

  // ── Alerts & Notifications ──
  { id: 'n-alt-hub', kind: 'screen', module: 'Alerts & Notifications', moduleId: 'alerts', label: 'Notifications Hub', description: 'Central hub for all system notifications', href: '/notifications-hub', icon: Bell, keywords: ['notifications', 'hub', 'alerts', 'messages'] },
  { id: 'n-alt-inbox', kind: 'screen', module: 'Alerts & Notifications', moduleId: 'alerts', label: 'Alerts Inbox', description: 'Unread alerts requiring attention', href: '/alerts-inbox', icon: Inbox, keywords: ['alerts', 'inbox', 'unread'] },
  { id: 'n-alt-remind', kind: 'screen', module: 'Alerts & Notifications', moduleId: 'alerts', label: 'Deadline Reminders', description: 'Upcoming deadline notifications', href: '/deadline-reminders', icon: AlarmClock, keywords: ['deadline', 'reminder', 'due', 'upcoming'] },
  { id: 'n-alt-log', kind: 'screen', module: 'Alerts & Notifications', moduleId: 'alerts', label: 'Alert Delivery Log', description: 'History of sent alert notifications', href: '/alerts-delivery', icon: SendHorizonal, keywords: ['delivery', 'log', 'sent', 'history'] },

  // ── Reports ──
  { id: 'n-rep-hub', kind: 'screen', module: 'Reports', moduleId: 'reports', label: 'Reports Hub', description: 'Regulatory, utilization & collateral reports', href: '/reports', icon: BarChart2, keywords: ['reports', 'regulatory', 'utilization', 'hub'] },
  { id: 'n-rep-custom', kind: 'screen', module: 'Reports', moduleId: 'reports', label: 'Custom Reports', description: 'Build and save custom report templates', href: '/custom-reports', icon: ScrollText, keywords: ['custom', 'report', 'template', 'build'] },
  { id: 'n-rep-export', kind: 'screen', module: 'Reports', moduleId: 'reports', label: 'Export', description: 'Export data to PDF, Excel, or CSV', href: '/export', icon: Download, keywords: ['export', 'pdf', 'excel', 'csv', 'download'] },

  // ── Audit & Compliance ──
  { id: 'n-aud-live', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Live Activity Stream', description: 'Real-time system activity feed', href: '/live-activity', icon: Radio, keywords: ['live', 'activity', 'stream', 'realtime'] },
  { id: 'n-aud-center', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Audit Center', description: 'Comprehensive audit management hub', href: '/audit-center', icon: DatabaseZap, keywords: ['audit', 'center', 'hub', 'management'] },
  { id: 'n-aud-trail', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Security & Compliance Trail', description: 'Full security and compliance audit trail', href: '/audit-trail', icon: ClipboardList, keywords: ['security', 'compliance', 'trail', 'audit'] },
  { id: 'n-aud-report', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Audit Report', description: 'Generate formal audit reports', href: '/audit-report', icon: BookOpen, keywords: ['audit', 'report', 'formal', 'generate'] },
  { id: 'n-aud-arch', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Archive Audit Log', description: 'Audit log for archived collateral activity', href: '/archive/audit-log', icon: FileStack, keywords: ['archive', 'audit', 'log'] },
  { id: 'n-aud-rules', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Compliance Rules', description: 'Define and manage compliance rule sets', href: '/compliance-rules', icon: Scale, keywords: ['compliance', 'rules', 'policy', 'define'] },
  { id: 'n-aud-comp', kind: 'screen', module: 'Audit & Compliance', moduleId: 'audit', label: 'Compliance Audit', description: 'Run compliance checks across collaterals', href: '/compliance-audit', icon: ShieldCheck, keywords: ['compliance', 'audit', 'check', 'run'] },

  // ── Administration ──
  { id: 'n-adm-users', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'User Management', description: 'Add, edit, and deactivate system users', href: '/user-management', icon: Users, keywords: ['users', 'manage', 'add', 'edit', 'deactivate'] },
  { id: 'n-adm-perms', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'Officer Permissions', description: 'Configure role-based access for officers', href: '/officer-permissions', icon: KeyRound, keywords: ['permissions', 'rbac', 'roles', 'access', 'officer'] },
  { id: 'n-adm-bank', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'Client Bank Accounts', description: 'Manage client bank account records', href: '/client-bank-accounts', icon: Landmark, keywords: ['bank', 'accounts', 'client', 'financial'] },
  { id: 'n-adm-settings', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'System Settings', description: 'Configure system-wide settings', href: '/settings', icon: Settings, keywords: ['settings', 'config', 'system', 'configure'] },
  { id: 'n-adm-thresh', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'Alert Thresholds', description: 'Set alert trigger thresholds', href: '/alert-thresholds', icon: SlidersHorizontal, keywords: ['thresholds', 'alerts', 'trigger', 'configure'] },
  { id: 'n-adm-sysconf', kind: 'screen', module: 'Administration', moduleId: 'administration', label: 'System Config', description: 'Advanced system configuration options', href: '/system-config', icon: Brain, keywords: ['system', 'config', 'advanced', 'configuration'] },

  // ── Archive ──
  { id: 'n-arc-vault', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Vault Management', description: 'Manage physical vault storage locations', href: '/archive/vault-management', icon: Building2, keywords: ['vault', 'storage', 'physical', 'manage'] },
  { id: 'n-arc-place', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Collateral Placement', description: 'Track collateral placement in vaults', href: '/archive/collateral-placement', icon: MapPin, keywords: ['placement', 'vault', 'location', 'track'] },
  { id: 'n-arc-lib', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Documents Library', description: 'Archived document repository', href: '/archive/documents-library', icon: Library, keywords: ['documents', 'library', 'archive', 'repository'] },
  { id: 'n-arc-docmgmt', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Document Management', description: 'Manage and organise archived documents', href: '/document-management', icon: FolderArchive, keywords: ['document', 'management', 'organise', 'archive'] },
  { id: 'n-arc-req', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Request Workflow', description: 'Archive retrieval request workflows', href: '/archive/request-workflow', icon: ClipboardCheck, keywords: ['request', 'workflow', 'retrieval', 'archive'] },
  { id: 'n-arc-cust', kind: 'screen', module: 'Archive', moduleId: 'archive', label: 'Custody Tracker', description: 'Track custody chain of archived items', href: '/archive/custody-tracker', icon: Eye, keywords: ['custody', 'tracker', 'chain', 'archive'] },

  // ── Quick Actions ──
  { id: 'qa-new-col', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'New Collateral', description: 'Register a new collateral record', href: '/collateral-management', icon: FolderOpen, keywords: ['new', 'add', 'create', 'collateral', 'register'] },
  { id: 'qa-approval', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Review Approvals', description: 'Go to the approval inbox', href: '/approval-inbox', icon: MailCheck, keywords: ['approve', 'review', 'inbox', 'pending'] },
  { id: 'qa-export', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Export Report', description: 'Export data to PDF or Excel', href: '/export', icon: Download, keywords: ['export', 'report', 'pdf', 'excel'] },
  { id: 'qa-bulk', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Bulk Upload', description: 'Import records via CSV', href: '/bulk-upload', icon: Upload, keywords: ['bulk', 'upload', 'import', 'csv'] },
  { id: 'qa-fraud', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Check Fraud Alerts', description: 'Review AI fraud prevention flags', href: '/fraud-prevention', icon: ShieldAlert, keywords: ['fraud', 'alerts', 'check', 'ai'] },
  { id: 'qa-onboard', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Onboarding Guide', description: 'Learn about all 9 modules', href: '/onboarding-guide', icon: BookOpen, keywords: ['onboarding', 'guide', 'help', 'learn', 'modules'] },
  { id: 'qa-modules', kind: 'quick-action', module: 'Quick Actions', moduleId: 'quick-actions', label: 'Module Hub', description: 'Switch between all modules', href: '/module-hub', icon: LayoutGrid, keywords: ['modules', 'hub', 'switch', 'navigate'] },
];

// Module color map
const MODULE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  collaterals:    { bg: 'bg-blue-50',   text: 'text-blue-600',   dot: 'bg-blue-500' },
  obligors:       { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  approvals:      { bg: 'bg-amber-50',  text: 'text-amber-600',  dot: 'bg-amber-500' },
  intelligence:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   dot: 'bg-cyan-500' },
  alerts:         { bg: 'bg-rose-50',   text: 'text-rose-600',   dot: 'bg-rose-500' },
  reports:        { bg: 'bg-emerald-50',text: 'text-emerald-600',dot: 'bg-emerald-500' },
  audit:          { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
  administration: { bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-500' },
  archive:        { bg: 'bg-stone-50',  text: 'text-stone-600',  dot: 'bg-stone-500' },
  'quick-actions':{ bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
};

const DB_TYPE_CONFIG = {
  collateral: { label: 'Collateral Record', bg: 'bg-blue-50',   text: 'text-blue-600' },
  document:   { label: 'Document',          bg: 'bg-purple-50', text: 'text-purple-600' },
  audit:      { label: 'Audit Log',         bg: 'bg-amber-50',  text: 'text-amber-600' },
  user:       { label: 'User',              bg: 'bg-green-50',  text: 'text-green-600' },
};

// ─── Fuzzy-ish search helper ──────────────────────────────────────────────────

function scoreNavResult(item: NavResult, q: string): number {
  const lower = q.toLowerCase().trim();
  if (!lower) return 0;
  const label = item.label.toLowerCase();
  const desc = item.description.toLowerCase();
  const mod = item.module.toLowerCase();
  const kw = (item.keywords ?? []).join(' ').toLowerCase();

  if (label === lower) return 100;
  if (label.startsWith(lower)) return 90;
  if (label.includes(lower)) return 80;
  if (desc.includes(lower)) return 60;
  if (mod.includes(lower)) return 50;
  if (kw.includes(lower)) return 70;

  // word-level partial match
  const words = lower.split(/\s+/);
  const allText = `${label} ${desc} ${mod} ${kw}`;
  const matchCount = words.filter((w) => allText.includes(w)).length;
  if (matchCount === words.length) return 40;
  if (matchCount > 0) return 20 * (matchCount / words.length);

  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [navResults, setNavResults] = useState<NavResult[]>([]);
  const [dbResults, setDbResults] = useState<DbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // All results combined for keyboard nav
  const allResults: AnyResult[] = [...navResults, ...dbResults];

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setNavResults([]);
      setDbResults([]);
      setSelectedIdx(0);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Nav search (instant, client-side)
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 1) { setNavResults([]); return; }
    const scored = NAV_INDEX
      .map((item) => ({ item, score: scoreNavResult(item, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.item);
    setNavResults(scored);
    setSelectedIdx(0);
  }, [query]);

  // DB search (debounced)
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setDbResults([]); return; }
    const timer = setTimeout(() => doDbSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const doDbSearch = async (q: string) => {
    setLoading(true);
    const supabase = createClient();
    const term = `%${q}%`;
    const found: DbResult[] = [];

    try {
      const { data: cols } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, obligor, collateral_type, status')
        .or(`collateral_id.ilike.${term},obligor.ilike.${term},facility_id.ilike.${term}`)
        .limit(4);

      (cols ?? []).forEach((r: any) => {
        found.push({
          id: r.id, kind: 'db', type: 'collateral',
          title: r.collateral_id,
          subtitle: `${r.obligor} · ${r.collateral_type}`,
          href: `/collateral-management`,
          badge: r.status,
          badgeColor: r.status === 'Perfected' ? 'bg-green-100 text-green-700' : r.status === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
        });
      });

      const { data: docs } = await supabase
        .from('collateral_documents')
        .select('id, file_name, document_type, collateral_id')
        .or(`file_name.ilike.${term},document_type.ilike.${term}`)
        .limit(3);

      (docs ?? []).forEach((r: any) => {
        found.push({
          id: r.id, kind: 'db', type: 'document',
          title: r.file_name,
          subtitle: `${r.document_type} · ${r.collateral_id}`,
          href: `/collateral-documents`,
          badge: r.document_type,
          badgeColor: 'bg-purple-100 text-purple-700',
        });
      });

      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, action, message, collateral_id, performed_by_name')
        .or(`message.ilike.${term},collateral_id.ilike.${term},performed_by_name.ilike.${term}`)
        .order('created_at', { ascending: false })
        .limit(3);

      (logs ?? []).forEach((r: any) => {
        found.push({
          id: r.id, kind: 'db', type: 'audit',
          title: r.message || r.action,
          subtitle: `${r.collateral_id ?? 'System'} · by ${r.performed_by_name ?? 'Unknown'}`,
          href: `/audit-trail`,
          badge: r.action,
          badgeColor: 'bg-amber-100 text-amber-700',
        });
      });

      const { data: users } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(3);

      (users ?? []).forEach((r: any) => {
        found.push({
          id: r.id, kind: 'db', type: 'user',
          title: r.full_name || r.email,
          subtitle: `${r.email} · ${(r.role ?? '').replace(/_/g, ' ')}`,
          href: `/user-management`,
          badge: r.role?.replace(/_/g, ' '),
          badgeColor: 'bg-green-100 text-green-700',
        });
      });
    } catch { /* silent */ }

    setDbResults(found);
    setLoading(false);
  };

  const navigate = useCallback((href: string) => {
    router.push(href);
    setOpen(false);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allResults.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && allResults[selectedIdx]) {
      navigate(allResults[selectedIdx].href);
    }
  };

  // Group nav results by module
  const navByModule = navResults.reduce((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {} as Record<string, NavResult[]>);

  // Group db results by type
  const dbByType = dbResults.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, DbResult[]>);

  const hasResults = navResults.length > 0 || dbResults.length > 0;
  const isSearching = query.trim().length > 0;

  // Quick actions for empty state
  const quickActions = NAV_INDEX.filter((n) => n.kind === 'quick-action');

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open global search (Ctrl+K)"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm w-full max-w-xs transition-all"
        style={{
          backgroundColor: 'var(--izou-primary-light)',
          border: '1px solid rgba(0,169,224,0.2)',
          color: 'var(--izou-muted)',
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,169,224,0.4)'; }}
        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,169,224,0.2)'; }}
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search everything…</span>
        <kbd
          className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ backgroundColor: 'white', border: '1px solid var(--izou-border)' }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh', border: '1px solid var(--izou-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div
              className="flex items-center gap-3 px-4 py-3.5 shrink-0"
              style={{ borderBottom: '1px solid var(--izou-border)' }}
            >
              <Search size={18} className="shrink-0" style={{ color: 'var(--izou-primary)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search modules, screens, features, records…"
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: 'var(--izou-text)' }}
                aria-label="Search"
                autoComplete="off"
              />
              {loading && <Loader2 size={16} className="animate-spin shrink-0" style={{ color: 'var(--izou-primary)' }} />}
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="transition-colors"
                  style={{ color: 'var(--izou-muted)' }}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="transition-colors ml-1"
                style={{ color: 'var(--izou-muted)' }}
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">

              {/* ── Empty state: quick actions + module grid ── */}
              {!isSearching && (
                <div className="px-4 py-4">
                  {/* Quick Actions */}
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color: 'var(--izou-muted)' }}
                  >
                    <Sparkles size={10} />
                    Quick Actions
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-4">
                    {quickActions.map((qa) => {
                      const QaIcon = qa.icon;
                      return (
                        <button
                          key={qa.id}
                          onClick={() => navigate(qa.href)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left group transition-all"
                          style={{
                            border: '1px solid var(--izou-border)',
                          }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,169,224,0.3)';
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--izou-border)';
                          }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' }}
                          >
                            <QaIcon size={13} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'var(--izou-text)' }}>{qa.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Module grid */}
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                    style={{ color: 'var(--izou-muted)' }}
                  >
                    <Hash size={10} />
                    Browse Modules
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'collaterals', label: 'Collaterals', href: '/collateral-dashboard', icon: FolderOpen },
                      { id: 'obligors', label: 'Obligors', href: '/obligors', icon: Users },
                      { id: 'approvals', label: 'Approvals', href: '/approval-inbox', icon: MailCheck },
                      { id: 'intelligence', label: 'Intelligence', href: '/executive-dashboard', icon: Brain },
                      { id: 'alerts', label: 'Alerts', href: '/notifications-hub', icon: Bell },
                      { id: 'reports', label: 'Reports', href: '/reports', icon: BarChart2 },
                      { id: 'audit', label: 'Audit & Compliance', href: '/audit-center', icon: ShieldCheck },
                      { id: 'administration', label: 'Administration', href: '/user-management', icon: Settings },
                      { id: 'archive', label: 'Archive', href: '/archive/vault-management', icon: FolderArchive },
                    ].map((mod) => {
                      const ModIcon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => navigate(mod.href)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-left group transition-all"
                          style={{ border: '1px solid var(--izou-border)' }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,169,224,0.3)';
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--izou-border)';
                          }}
                        >
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' }}
                          >
                            <ModIcon size={12} />
                          </div>
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--izou-text)' }}>{mod.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-center text-[11px] mt-4" style={{ color: 'var(--izou-muted)' }}>
                    Start typing to search across all screens, features, and records
                  </p>
                </div>
              )}

              {/* ── No results ── */}
              {isSearching && !hasResults && !loading && (
                <div className="px-4 py-10 text-center">
                  <Search size={24} className="mx-auto mb-2" style={{ color: 'var(--izou-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--izou-text)' }}>No results for "<strong>{query}</strong>"</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Try a module name, screen name, or feature keyword</p>
                </div>
              )}

              {/* ── Results ── */}
              {isSearching && hasResults && (
                <div className="py-2">

                  {/* Nav results grouped by module */}
                  {Object.entries(navByModule).map(([moduleName, items]) => {
                    const moduleId = items[0].moduleId;
                    const colors = MODULE_COLORS[moduleId] ?? MODULE_COLORS['quick-actions'];
                    return (
                      <div key={moduleName}>
                        <div className="flex items-center gap-2 px-4 py-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--izou-muted)' }}>{moduleName}</p>
                        </div>
                        {items.map((r) => {
                          const RIcon = r.icon;
                          const globalIdx = allResults.indexOf(r);
                          return (
                            <button
                              key={r.id}
                              onClick={() => navigate(r.href)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={{
                                backgroundColor: globalIdx === selectedIdx ? 'var(--izou-primary-light)' : 'transparent',
                              }}
                              onMouseOver={(e) => { if (globalIdx !== selectedIdx) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
                              onMouseOut={(e) => { if (globalIdx !== selectedIdx) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                                <RIcon size={13} className={colors.text} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--izou-text)' }}>{r.label}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--izou-muted)' }}>{r.description}</p>
                              </div>
                              <ArrowRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100" style={{ color: 'var(--izou-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* DB results */}
                  {Object.entries(dbByType).map(([type, items]) => {
                    const cfg = DB_TYPE_CONFIG[type as keyof typeof DB_TYPE_CONFIG];
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-2 px-4 py-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-400" />
                          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--izou-muted)' }}>{cfg?.label ?? type}</p>
                        </div>
                        {items.map((r) => {
                          const globalIdx = allResults.indexOf(r);
                          return (
                            <button
                              key={r.id}
                              onClick={() => navigate(r.href)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                              style={{
                                backgroundColor: globalIdx === selectedIdx ? 'var(--izou-primary-light)' : 'transparent',
                              }}
                              onMouseOver={(e) => { if (globalIdx !== selectedIdx) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
                              onMouseOut={(e) => { if (globalIdx !== selectedIdx) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg?.bg ?? 'bg-gray-50'}`}>
                                <FileText size={13} className={cfg?.text ?? 'text-gray-600'} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--izou-text)' }}>{r.title}</p>
                                <p className="text-xs truncate" style={{ color: 'var(--izou-muted)' }}>{r.subtitle}</p>
                              </div>
                              {r.badge && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${r.badgeColor}`}>{r.badge}</span>
                              )}
                              <ChevronRight size={13} className="shrink-0" style={{ color: 'var(--izou-muted)' }} />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-4 py-2.5 flex items-center gap-4 text-[10px] shrink-0"
              style={{
                borderTop: '1px solid var(--izou-border)',
                backgroundColor: 'var(--izou-primary-light)',
                color: 'var(--izou-muted)',
              }}
            >
              <span className="flex items-center gap-1">
                <kbd
                  className="px-1 py-0.5 rounded font-mono"
                  style={{ backgroundColor: 'white', border: '1px solid var(--izou-border)' }}
                >↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd
                  className="px-1 py-0.5 rounded font-mono"
                  style={{ backgroundColor: 'white', border: '1px solid var(--izou-border)' }}
                >↵</kbd> Open
              </span>
              <span className="flex items-center gap-1">
                <kbd
                  className="px-1 py-0.5 rounded font-mono"
                  style={{ backgroundColor: 'white', border: '1px solid var(--izou-border)' }}
                >Esc</kbd> Close
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd
                  className="px-1.5 py-0.5 rounded font-mono"
                  style={{ backgroundColor: 'white', border: '1px solid var(--izou-border)' }}
                >⌘K</kbd> to toggle
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
