import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ValuationPricingFlagsContent from './components/ValuationPricingFlagsContent';

export default function ValuationPricingFlagsPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading...</div>}>
        <ValuationPricingFlagsContent />
      </Suspense>
    </AppLayout>
  );
}
