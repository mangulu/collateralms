'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import UnifiedTaskListContent from './components/UnifiedTaskListContent';

export default function WorkflowsTasksPage() {
  return (
    <AppLayout>
      <UnifiedTaskListContent />
    </AppLayout>
  );
}
