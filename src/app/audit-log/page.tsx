import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuditLogContent from './components/AuditLogContent';

export const metadata = {
  title: 'Audit Log | CollateralMS',
  description: 'Complete audit trail for collateral and workflow changes with field-level history',
};

export default function AuditLogPage() {
  return (
    <AppLayout>
      <AuditLogContent />
    </AppLayout>
  );
}
