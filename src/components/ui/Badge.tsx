import React from 'react';

type BadgeVariant =
  | 'perfected' | 'pending' | 'overdue' | 'draft' | 'released' | 'monitoring' | 'rejected' | 'under-review' | 'submitted';

const variantMap: Record<BadgeVariant, string> = {
  perfected: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  overdue: 'bg-red-50 text-red-700 border border-red-200',
  draft: 'bg-slate-100 text-slate-600 border border-slate-200',
  released: 'border',
  monitoring: 'bg-teal-50 text-teal-700 border border-teal-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  'under-review': 'bg-purple-50 text-purple-700 border border-purple-200',
  submitted: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
};

// Dynamic class for 'released' to use the IZOU brand primary color
const releasedStyle = {
  backgroundColor: 'var(--izou-primary-tint)',
  color: 'var(--izou-primary-dark)',
  borderColor: 'var(--izou-primary-tint)',
};

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export default function Badge({ variant, label, className = '' }: BadgeProps) {
  if (variant === 'released') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${className}`}
        style={releasedStyle}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${variantMap[variant]} ${className}`}
    >
      {label}
    </span>
  );
}