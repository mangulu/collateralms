'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';

const FraudPreventionContent = dynamic(() => import('./components/FraudPreventionContent'), { ssr: false });

export default function FraudPreventionPage() {
  return (
    <AppLayout currentPath="/fraud-prevention">
      <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
        <FraudPreventionContent />
      </Suspense>
    </AppLayout>
  );
}
