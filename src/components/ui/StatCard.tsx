import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  /** Color of the value text (and the icon, when no explicit icon color is set). Defaults to the brand secondary (navy). */
  color?: string;
  /** Label color override — for a severity-tinted card (e.g. a warning/critical KPI), pass this alongside bg/border. */
  labelColor?: string;
  /** Card background — defaults to the standard light-navy card used across most Archive pages. */
  bg?: string;
  /** Card border — defaults to match the standard card. */
  border?: string;
}

/**
 * The KPI tile used across Archive pages: light card, label, big colored
 * number, optional icon. Centralized here so a future visual pass changes
 * every page at once instead of hunting down each hand-copied instance.
 */
export default function StatCard({ label, value, icon, color = 'var(--izou-secondary)', labelColor = 'var(--izou-muted)', bg = 'var(--izou-secondary-light)', border = 'var(--izou-secondary-light)' }: StatCardProps) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      {icon && (
        <div className="mb-1" style={{ color }}>
          {icon}
        </div>
      )}
      <p className="text-xs font-medium mb-1" style={{ color: labelColor }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
