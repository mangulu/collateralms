'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import TriggerProcessorAdminContent from './components/TriggerProcessorAdminContent';

export default function TriggerProcessorAdminPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <TriggerProcessorAdminContent />
      </AdminGuard>
    </AppLayout>
  );
}
