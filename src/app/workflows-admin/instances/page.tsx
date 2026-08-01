'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import WorkflowInstancesContent from '@/app/workflows/instances/components/WorkflowInstancesContent';

export default function WorkflowsAdminInstancesPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <WorkflowInstancesContent />
      </AdminGuard>
    </AppLayout>
  );
}
