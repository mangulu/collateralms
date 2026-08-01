'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import WorkflowTemplatesContent from '@/app/workflows/templates/components/WorkflowTemplatesContent';

export default function WorkflowsAdminTemplatesPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <WorkflowTemplatesContent />
      </AdminGuard>
    </AppLayout>
  );
}
