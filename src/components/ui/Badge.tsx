import React from 'react';

type BadgeVariant =
  | 'perfected' |'pending' |'overdue' |'draft' |'released' |'monitoring' |'rejected' |'under-review' |'submitted';

const variantMap: Record<BadgeVariant, string> = {
  perfected: 'bg-green-100 text-green-700 border border-green-200',
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  overdue: 'bg-red-100 text-red-700 border border-red-200',
  draft: 'bg-gray-100 text-gray-600 border border-gray-200',
  released: 'bg-blue-100 text-blue-700 border border-blue-200',
  monitoring: 'bg-teal-100 text-teal-700 border border-teal-200',
  rejected: 'bg-red-100 text-red-700 border border-red-200',
  'under-review': 'bg-purple-100 text-purple-700 border border-purple-200',
  submitted: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
};

interface BadgeProps {
  variant: BadgeVariant;
  label: string;
  className?: string;
}

export default function Badge({ variant, label, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-500 ${variantMap[variant]} ${className}`}
    >
      {label}
    </span>
  );
}