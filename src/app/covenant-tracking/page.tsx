import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CovenantTrackingContent from './components/CovenantTrackingContent';

export default function CovenantTrackingPage() {
  return (
    <AppLayout>
      <Suspense>
        <CovenantTrackingContent />
      </Suspense>
    </AppLayout>
  );
}
