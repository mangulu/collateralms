'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import EscalationConfigContent from './components/EscalationConfigContent';

export default function EscalationConfigPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <EscalationConfigContent />
      </AdminGuard>
    </AppLayout>
  );
}
