'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const LiveActivityContent = dynamic(() => import('./components/LiveActivityContent'), { ssr: false });

export default function LiveActivityPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/live-activity">
      {!loading && !hasPermission(PERMISSIONS?.AUDIT_LOG_VIEW) ? (
        <AccessDenied title="Live Activity Stream" />
      ) : (
        <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
          <LiveActivityContent />
        </Suspense>
      )}
    </AppLayout>
  );
}
