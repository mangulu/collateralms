'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const BulkUploadContent = dynamic(() => import('./components/BulkUploadContent'), { ssr: false });

export default function BulkUploadPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/bulk-upload">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_EDIT) ? (
        <AccessDenied title="Bulk Upload" />
      ) : (
        <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={200} /></div>}>
          <BulkUploadContent />
        </Suspense>
      )}
    </AppLayout>
  );
}
