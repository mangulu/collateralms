import React from 'react';
import AppLayout from '@/components/AppLayout';
import ComplianceAuditContent from './components/ComplianceAuditContent';

export default function ComplianceAuditPage() {
  return (
    <AppLayout currentPath="/compliance-audit">
      <ComplianceAuditContent />
    </AppLayout>
  );
}
