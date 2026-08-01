'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CollateralSubstitutionContent from '@/app/collateral-substitution/components/CollateralSubstitutionContent';

export default function WorkflowsSubstitutionPage() {
  return (
    <AppLayout>
      <Suspense>
        <CollateralSubstitutionContent />
      </Suspense>
    </AppLayout>
  );
}
