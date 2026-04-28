'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ComplianceRulesContent from './components/ComplianceRulesContent';

export default function ComplianceRulesPage() {
  return (
    <AppLayout currentPath="/compliance-rules">
      <ComplianceRulesContent />
    </AppLayout>
  );
}
