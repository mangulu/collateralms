'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ComplianceRulesContent from './components/ComplianceRulesContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ComplianceRulesPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/compliance-rules">
      {!loading && !hasPermission(PERMISSIONS?.COMPLIANCE_VIEW) ? (
        <AccessDenied title="Compliance Rules" />
      ) : (
        <ComplianceRulesContent />
      )}
    </AppLayout>
  );
}
