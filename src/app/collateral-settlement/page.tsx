'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CollateralSettlementContent from './components/CollateralSettlementContent';

export default function CollateralSettlementPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <CollateralSettlementContent />
      </Suspense>
    </AppLayout>
  );
}
