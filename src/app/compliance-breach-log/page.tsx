'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ComplianceBreachLogContent from './components/ComplianceBreachLogContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ComplianceBreachLogPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/compliance-breach-log">
      {!loading && !hasPermission(PERMISSIONS?.COMPLIANCE_VIEW) ? (
        <AccessDenied title="Breach Log" />
      ) : (
        <ComplianceBreachLogContent />
      )}
    </AppLayout>
  );
}
