'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';

const PortfolioMonitoringContent = dynamic(() => import('./components/PortfolioMonitoringContent'), { ssr: false });

export default function PortfolioMonitoringPage() {
  return (
    <AppLayout currentPath="/portfolio-monitoring">
      <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
        <PortfolioMonitoringContent />
      </Suspense>
    </AppLayout>
  );
}
