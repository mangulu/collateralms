'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';

const RiskAssessmentContent = dynamic(() => import('./components/RiskAssessmentContent'), { ssr: false });

export default function RiskAssessmentPage() {
  return (
    <AppLayout currentPath="/risk-assessment">
      <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
        <RiskAssessmentContent />
      </Suspense>
    </AppLayout>
  );
}
