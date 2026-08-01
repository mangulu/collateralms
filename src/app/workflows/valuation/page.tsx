'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ValuationWorkflowContent from '@/app/valuation-workflow/components/ValuationWorkflowContent';

export default function WorkflowsValuationPage() {
  return (
    <AppLayout>
      <Suspense>
        <ValuationWorkflowContent />
      </Suspense>
    </AppLayout>
  );
}
