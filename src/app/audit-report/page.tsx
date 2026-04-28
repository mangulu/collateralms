'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuditReportContent from './components/AuditReportContent';

export default function AuditReportPage() {
  return (
    <AppLayout currentPath="/audit-report">
      <AuditReportContent />
    </AppLayout>
  );
}
