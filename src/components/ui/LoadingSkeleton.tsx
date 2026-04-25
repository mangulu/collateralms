import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-muted rounded-md ${className}`} />
  );
}

export function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-card border border-border">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 8 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={`skel-col-${i}`} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="animate-pulse bg-muted rounded-lg w-full"
      style={{ height }}
    />
  );
}