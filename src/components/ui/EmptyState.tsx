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
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon size={24} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-600 text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-500 rounded-md hover:bg-primary/90 transition-all duration-150 active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}