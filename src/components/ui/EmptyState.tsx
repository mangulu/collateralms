import React from 'react';
import { LucideIcon } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: IconComp,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const Icon = IconComp as React.ElementType;
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' }}
      >
        <Icon size={24} />
      </div>
      <h3 className="text-base font-bold mb-1" style={{ color: 'var(--izou-text)' }}>{title}</h3>
      <p className="text-sm max-w-sm mb-5" style={{ color: 'var(--izou-muted)' }}>{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="izou-btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}