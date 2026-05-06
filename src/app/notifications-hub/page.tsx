'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import NotificationsHubContent from './components/NotificationsHubContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function NotificationsHubPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/notifications-hub">
      {!loading && !hasPermission(PERMISSIONS?.DASHBOARD_VIEW) ? (
        <AccessDenied title="Notifications Hub" />
      ) : (
        <NotificationsHubContent />
      )}
    </AppLayout>
  );
}
