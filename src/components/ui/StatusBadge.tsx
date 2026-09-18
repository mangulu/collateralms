import React from 'react';

interface StatusBadgeProps {
  label: string;
  bg: string;
  text: string;
  border?: string;
  icon?: React.ElementType;
  size?: number;
  /** Larger, more emphasized variant used for a "hero" badge (e.g. a detail drawer's header status), vs the default compact inline pill. */
  large?: boolean;
}

/**
 * The colored rounded-full status pill used everywhere a STATUS_CONFIG-style
 * map drives a badge (request status, custody status, disposal state, etc).
 * Centralized so a future visual pass changes every page at once.
 */
export default function StatusBadge({ label, bg, text, border, icon: Icon, size = 11, large = false }: StatusBadgeProps) {
  return (
    <span
      className={large
        ? 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full'
        : 'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full'}
      style={{ backgroundColor: bg, color: text, border: border ? `1px solid ${border}` : undefined }}
    >
      {Icon && <Icon size={size} />}
      {label}
    </span>
  );
}
