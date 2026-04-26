'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import NotificationsHubContent from './components/NotificationsHubContent';

export default function NotificationsHubPage() {
  return (
    <AppLayout currentPath="/notifications-hub">
      <NotificationsHubContent />
    </AppLayout>
  );
}
