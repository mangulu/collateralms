'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import WorkflowsAdminDashboardContent from './components/WorkflowsAdminDashboardContent';

export default function WorkflowsAdminPage() {
  return (
    <AppLayout>
      <WorkflowsAdminDashboardContent />
    </AppLayout>
  );
}
