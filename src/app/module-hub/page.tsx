'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import {
  FolderOpen,
  Brain,
  Bell,
  BarChart2,
  ShieldCheck,
  Settings,
  LogOut,
  TrendingUp,
  ChevronRight,
  Layers,
  Archive,
  Users,
  CheckSquare,
  BookOpen,
  HelpCircle,
} from 'lucide-react';


interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
  bgGradient: string;
  iconBg: string;
  stats: string;
  requiredPermission?: string;
  adminOnly?: boolean;
}

const modules: ModuleCard[] = [
  {
    id: 'collaterals',
    title: 'Collaterals',
    description: 'Manage collateral registry, documents, batch operations, and scheduled jobs.',
    icon: FolderOpen,
    href: '/collateral-management',
    color: '#007CB3',
    bgGradient: 'linear-gradient(135deg, #e8f8fd 0%, #cdf0fb 60%, #9be1f7 100%)',
    iconBg: '#00A9E0',
    stats: 'Registry · Workflows · Documents',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'obligors',
    title: 'Obligors',
    description: 'Manage obligor profiles, credit risk scores, exposure metrics, and approval trends.',
    icon: Users,
    href: '/obligors',
    color: '#0F766E',
    bgGradient: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 60%, #99F6E4 100%)',
    iconBg: '#00C2A8',
    stats: 'Profiles · Risk · Exposure',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'approvals',
    title: 'Workflows',
    description: 'Centralised approval inbox for perfection, document, release, and archive request workflows.',
    icon: CheckSquare,
    href: '/approval-inbox',
    color: '#007CB3',
    bgGradient: 'linear-gradient(135deg, #e8f8fd 0%, #cdf0fb 60%, #9be1f7 100%)',
    iconBg: '#1AB8E6',
    stats: 'Inbox · Perfection · Archive Requests',
    requiredPermission: PERMISSIONS.PERFECTION_VIEW,
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    description: 'AI-powered risk assessment, fraud prevention, deadline predictions, and analytics.',
    icon: Brain,
    href: '/executive-dashboard',
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 60%, #DDD6FE 100%)',
    iconBg: '#7C3AED',
    stats: 'AI Risk · Fraud · Predictions',
    requiredPermission: PERMISSIONS.COMPLIANCE_VIEW,
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    description: 'Monitor deadline reminders, notification delivery logs, and alerts inbox.',
    icon: Bell,
    href: '/notifications-hub',
    color: '#B45309',
    bgGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)',
    iconBg: '#D97706',
    stats: 'Reminders · Delivery · Inbox',
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Reports Hub with regulatory and utilization views, custom reports, and unified export.',
    icon: BarChart2,
    href: '/reports',
    color: '#065F46',
    bgGradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 60%, #A7F3D0 100%)',
    iconBg: '#059669',
    stats: 'Reports Hub · Custom · Export',
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: 'audit',
    title: 'Audit & Compliance',
    description: 'Full audit trails, archive audit log, compliance rules, live activity streams, and audit reports.',
    icon: ShieldCheck,
    href: '/audit-center',
    color: '#9D174D',
    bgGradient: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 60%, #FECDD3 100%)',
    iconBg: '#E11D48',
    stats: 'Trails · Archive · Compliance',
    requiredPermission: PERMISSIONS.AUDIT_LOG_VIEW,
  },
  {
    id: 'administration',
    title: 'Administration',
    description: 'User management, officer permissions, system settings, alert thresholds, and client bank accounts.',
    icon: Settings,
    href: '/user-management',
    color: '#374151',
    bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 60%, #E5E7EB 100%)',
    iconBg: '#4B5563',
    stats: 'Users · Roles · Settings',
    adminOnly: true,
    requiredPermission: PERMISSIONS.USER_MANAGEMENT_VIEW,
  },
  {
    id: 'archive',
    title: 'Archive',
    description: 'Physical vault management, collateral placement, document management, file loan workflow, and custody tracking.',
    icon: Archive,
    href: '/archive/vault-management',
    color: '#92400E',
    bgGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)',
    iconBg: '#D97706',
    stats: 'Vaults · Documents · Custody',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
];

export default function ModuleHubPage() {
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const { hasPermission, isSystemAdmin, loading } = usePermissions();

  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';
  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const visibleModules = loading
    ? modules
    : modules.filter((m) => {
        if (m.adminOnly && !isSystemAdmin) return false;
        if (m.requiredPermission && !isSystemAdmin && !hasPermission(m.requiredPermission)) return false;
        return true;
      });

  const handleModuleClick = (href: string) => {
    router.push(href);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--izou-bg)' }}>
      {/* Top Bar — light card style */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          backgroundColor: 'var(--izou-card)',
          borderBottom: '1px solid var(--izou-border)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <AppLogo size={32} />
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--izou-text)' }}>CollateralMS</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--izou-muted)' }}>Module Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Help / Guide icon */}
          <button
            onClick={() => router.push('/onboarding-guide')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors"
            style={{ color: 'var(--izou-primary)', border: '1px solid var(--izou-border)' }}
            title="Open Onboarding Guide"
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <HelpCircle size={16} />
            <span className="hidden sm:inline text-xs font-medium">Guide</span>
          </button>

          <div className="hidden sm:flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--izou-primary)', border: '1px solid var(--izou-border)' }}
            >
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--izou-text)' }}>{displayName}</p>
              <p className="text-xs leading-tight" style={{ color: 'var(--izou-muted)' }}>{displayRole}</p>
            </div>
          </div>
          <button
            onClick={() => signOut?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors"
            style={{ color: 'var(--izou-muted)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-primary)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-muted)'; }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 pt-10 pb-6 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary-dark)' }}
        >
          <Layers size={12} />
          <span>Select a module to get started</span>
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--izou-text)' }}>
          Welcome back, {displayName.split(' ')[0]}
        </h1>
        <p className="text-sm" style={{ color: 'var(--izou-muted)' }}>
          Choose a module below to begin working
        </p>
      </div>

      {/* Module Cards */}
      <div className="flex-1 px-6 pb-10 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleModules.map((mod, idx) => {
            const ModIcon = mod.icon;
            const isFeature = idx === 0;
            return (
              <button
                key={mod.id}
                onClick={() => handleModuleClick(mod.href)}
                className={`group relative text-left rounded-2xl p-6 transition-all duration-200 hover:-translate-y-1 focus:outline-none ${
                  isFeature ? 'lg:col-span-2' : ''
                }`}
                style={{
                  background: mod.bgGradient,
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'transform 0.22s var(--izou-ease), box-shadow 0.22s var(--izou-ease)',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              >
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: mod.iconBg }}
                >
                  <ModIcon size={22} color="#fff" />
                </div>

                {/* Content */}
                <h2 className="text-base font-bold mb-1.5" style={{ color: mod.color }}>
                  {mod.title}
                </h2>
                <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--izou-muted)' }}>
                  {mod.description}
                </p>

                {/* Stats pill */}
                <div
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: mod.color }}
                >
                  <TrendingUp size={10} />
                  {mod.stats}
                </div>

                {/* Arrow */}
                <div
                  className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0.5"
                  style={{ backgroundColor: mod.iconBg }}
                >
                  <ChevronRight size={14} color="#fff" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {!loading && visibleModules.length === 0 && (
          <div className="text-center py-20">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--izou-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--izou-muted)' }}>
              No modules are available for your current role. Contact your administrator.
            </p>
          </div>
        )}

        {/* Onboarding Guide Section */}
        <div
          className="mt-10 rounded-2xl p-6"
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 60%, #BFDBFE 100%)',
            border: '1px solid rgba(37,99,235,0.15)',
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#2563EB' }}
            >
              <BookOpen size={22} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold mb-1" style={{ color: '#1D4ED8' }}>
                New to CollateralMS? Start with the Onboarding Guide
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#3B82F6' }}>
                Step-by-step walkthroughs for all 9 modules — from registering collateral to running compliance audits. Includes role-based user journeys and quick shortcuts.
              </p>
            </div>
            <button
              onClick={() => router.push('/onboarding-guide')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-all"
              style={{ backgroundColor: '#2563EB', color: '#fff' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1D4ED8'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2563EB'; }}
            >
              <BookOpen size={15} />
              Open Guide
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-xs" style={{ color: 'var(--izou-muted)' }}>
        Powered by{' '}
        <a
          href="https://contentpro.co.tz"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          style={{ color: 'var(--izou-primary)' }}
        >
          Contentpro
        </a>
      </footer>
    </div>
  );
}
