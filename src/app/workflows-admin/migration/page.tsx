'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AdminGuard from '../components/AdminGuard';
import MigrationToolContent from './components/MigrationToolContent';

export default function MigrationToolPage() {
  return (
    <AppLayout>
      <AdminGuard>
        <MigrationToolContent />
      </AdminGuard>
    </AppLayout>
  );
}
