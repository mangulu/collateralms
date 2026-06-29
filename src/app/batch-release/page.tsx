'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import BatchReleaseContent from './components/BatchReleaseContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function BatchReleasePage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/batch-release">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_EDIT) ? (
        <AccessDenied title="Batch Release" />
      ) : (
        <BatchReleaseContent />
      )}
    </AppLayout>
  );
}
