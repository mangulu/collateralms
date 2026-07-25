import React from 'react';
import AppLayout from '@/components/AppLayout';
import RequestStatusTrackerContent from './components/RequestStatusTrackerContent';

export default function RequestStatusPage() {
  return (
    <AppLayout>
      <RequestStatusTrackerContent />
    </AppLayout>
  );
}
