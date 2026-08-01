'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import TriggerRulesAdminContent from './components/TriggerRulesAdminContent';

export default function TriggerRulesAdminPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <TriggerRulesAdminContent />
      </AdminGuard>
    </AppLayout>
  );
}
