'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AlertsInboxContent from './components/AlertsInboxContent';

export default function AlertsInboxPage() {
  return (
    <AppLayout currentPath="/alerts-inbox">
      <AlertsInboxContent />
    </AppLayout>
  );
}
