'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const FraudPreventionContent = dynamic(() => import('./components/FraudPreventionContent'), { ssr: false });

export default function FraudPreventionPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/fraud-prevention">
      {!loading && !hasPermission(PERMISSIONS?.COMPLIANCE_VIEW) ? (
        <AccessDenied title="AI Fraud Prevention" />
      ) : (
        <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
          <FraudPreventionContent />
        </Suspense>
      )}
    </AppLayout>
  );
}
