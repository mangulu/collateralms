'use client';
import React from 'react';
import Link from 'next/link';
import {
  FilePlus,
  GitBranch,
  FileSearch,
  AlertTriangle,
  Upload,
  BarChart2,
  ChevronRight,
} from 'lucide-react';


interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconStyle: React.CSSProperties;
  iconBgStyle: React.CSSProperties;
}

const actions: QuickAction[] = [
  {
    label: 'Add Collateral',
    description: 'Register a new collateral item',
    href: '/collateral-management',
    icon: FilePlus,
    iconBgStyle: { backgroundColor: 'var(--izou-primary-light)' },
    iconStyle: { color: 'var(--izou-primary)' },
  },
  {
    label: 'Perfection Workflow',
    description: 'Manage pending perfection tasks',
    href: '/perfection-workflow',
    icon: GitBranch,
    iconBgStyle: { backgroundColor: 'var(--izou-success-light)' },
    iconStyle: { color: 'var(--izou-success)' },
  },
  {
    label: 'Compliance Audit',
    description: 'Review compliance status',
    href: '/compliance-audit',
    icon: FileSearch,
    iconBgStyle: { backgroundColor: 'var(--izou-secondary-light)' },
    iconStyle: { color: 'var(--izou-secondary)' },
  },
  {
    label: 'SMS Alerts',
    description: 'View pending SMS alerts & actions',
    href: '/alerts-inbox',
    icon: AlertTriangle,
    iconBgStyle: { backgroundColor: 'var(--izou-warning-light)' },
    iconStyle: { color: 'var(--izou-warning)' },
  },
  {
    label: 'Bulk Upload',
    description: 'Import collateral data via CSV',
    href: '/bulk-upload',
    icon: Upload,
    iconBgStyle: { backgroundColor: 'var(--izou-highlight-light)' },
    iconStyle: { color: 'var(--izou-highlight)' },
  },
  {
    label: 'Reports',
    description: 'Generate & export reports',
    href: '/reports',
    icon: BarChart2,
    iconBgStyle: { backgroundColor: 'var(--izou-secondary-light)' },
    iconStyle: { color: 'var(--izou-secondary-mid)' },
  },
];

export default function QuickActionsPanel() {
  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div className="mb-4">
        <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Quick Actions</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>Frequently used shortcuts</p>
      </div>
      <div className="space-y-1.5">
        {actions.map((action) => {
          const ActionIcon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                style={action.iconBgStyle}
              >
                <ActionIcon size={15} style={action.iconStyle} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold transition-colors" style={{ color: 'var(--izou-text)' }}>{action.label}</p>
                <p className="text-xs truncate" style={{ color: 'var(--izou-muted)' }}>{action.description}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 opacity-40 group-hover:opacity-100 transition-all" style={{ color: 'var(--izou-primary)' }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
