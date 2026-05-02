'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton, TableRowSkeleton } from '@/components/ui/LoadingSkeleton';

const AuditReportContent = dynamic(() => import('./components/AuditReportContent'), { ssr: false });

function AuditReportFallback() {
  return (
    <div className="p-6 space-y-4">
      <ChartSkeleton height={80} />
      <ChartSkeleton height={200} />
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
          <tbody>
            {Array.from({ length: 8 })?.map((_, i) => <TableRowSkeleton key={i} cols={6} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditReportPage() {
  return (
    <AppLayout currentPath="/audit-report">
      <Suspense fallback={<AuditReportFallback />}>
        <AuditReportContent />
      </Suspense>
    </AppLayout>
  );
}
