'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import WorkflowKPIsContent from './components/WorkflowKPIsContent';

export default function WorkflowKPIsPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <WorkflowKPIsContent />
      </AdminGuard>
    </AppLayout>
  );
}
