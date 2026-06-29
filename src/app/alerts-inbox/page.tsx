'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AlertsInboxContent from './components/AlertsInboxContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function AlertsInboxPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/alerts-inbox">
      {!loading && !hasPermission(PERMISSIONS?.DASHBOARD_VIEW) ? (
        <AccessDenied title="Alerts Inbox" />
      ) : (
        <AlertsInboxContent />
      )}
    </AppLayout>
  );
}
