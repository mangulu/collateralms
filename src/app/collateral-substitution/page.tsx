import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CollateralSubstitutionContent from './components/CollateralSubstitutionContent';

export default function CollateralSubstitutionPage() {
  return (
    <AppLayout>
      <Suspense>
        <CollateralSubstitutionContent />
      </Suspense>
    </AppLayout>
  );
}
