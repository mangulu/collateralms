'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ScheduledJobsContent from './components/ScheduledJobsContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ScheduledJobsPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/scheduled-jobs">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_EDIT) ? (
        <AccessDenied title="Scheduled Jobs" />
      ) : (
        <ScheduledJobsContent />
      )}
    </AppLayout>
  );
}
