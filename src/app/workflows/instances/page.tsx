'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import WorkflowInstancesContent from './components/WorkflowInstancesContent';

export default function WorkflowInstancesPage() {
  return (
    <AppLayout>
      <WorkflowInstancesContent />
    </AppLayout>
  );
}
