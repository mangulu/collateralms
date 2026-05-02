'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';

const LiveActivityContent = dynamic(() => import('./components/LiveActivityContent'), { ssr: false });

export default function LiveActivityPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
        <LiveActivityContent />
      </Suspense>
    </AppLayout>
  );
}
