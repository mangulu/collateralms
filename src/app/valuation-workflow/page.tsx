import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ValuationWorkflowContent from './components/ValuationWorkflowContent';

export default function ValuationWorkflowPage() {
  return (
    <AppLayout>
      <Suspense>
        <ValuationWorkflowContent />
      </Suspense>
    </AppLayout>
  );
}
