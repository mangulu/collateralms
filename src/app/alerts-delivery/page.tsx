'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AlertsDeliveryContent from './components/AlertsDeliveryContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function AlertsDeliveryPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/alerts-delivery">
      {!loading && !hasPermission(PERMISSIONS?.DASHBOARD_VIEW) ? (
        <AccessDenied title="Alert Delivery Log" />
      ) : (
        <AlertsDeliveryContent />
      )}
    </AppLayout>
  );
}
