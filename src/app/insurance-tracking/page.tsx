import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import InsuranceTrackingContent from './components/InsuranceTrackingContent';

export default function InsuranceTrackingPage() {
  return (
    <AppLayout>
      <Suspense>
        <InsuranceTrackingContent />
      </Suspense>
    </AppLayout>
  );
}
