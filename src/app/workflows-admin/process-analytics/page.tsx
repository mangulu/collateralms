'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import ProcessAnalyticsContent from './components/ProcessAnalyticsContent';

export default function ProcessAnalyticsPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <ProcessAnalyticsContent />
      </AdminGuard>
    </AppLayout>
  );
}
