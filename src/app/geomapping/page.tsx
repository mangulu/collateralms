'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import GeomappingContent from './components/GeomappingContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function GeomappingPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/geomapping">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_VIEW) ? (
        <AccessDenied title="Geomapping" />
      ) : (
        <GeomappingContent />
      )}
    </AppLayout>
  );
}
