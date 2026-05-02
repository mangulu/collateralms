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
import Icon from '@/components/ui/AppIcon';


interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const actions: QuickAction[] = [
  {
    label: 'Add Collateral',
    description: 'Register a new collateral item',
    href: '/collateral-management',
    icon: FilePlus,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    label: 'Perfection Workflow',
    description: 'Manage pending perfection tasks',
    href: '/perfection-workflow',
    icon: GitBranch,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    label: 'Compliance Audit',
    description: 'Review compliance status',
    href: '/compliance-audit',
    icon: FileSearch,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  {
    label: 'Alerts Inbox',
    description: 'View pending alerts & actions',
    href: '/alerts-inbox',
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  {
    label: 'Bulk Upload',
    description: 'Import collateral data via CSV',
    href: '/bulk-upload',
    icon: Upload,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
  },
  {
    label: 'Reports',
    description: 'Generate & export reports',
    href: '/reports',
    icon: BarChart2,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
  },
];

export default function QuickActionsPanel() {
  return (
    <div className="bg-white rounded-xl shadow-card border border-border p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-600 text-foreground">Quick Actions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Frequently used shortcuts</p>
      </div>
      <div className="space-y-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.iconBg}`}>
                <Icon size={15} className={action.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                <p className="text-xs text-muted-foreground truncate">{action.description}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
