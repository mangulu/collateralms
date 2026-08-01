import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LoanRegistryContent from './components/LoanRegistryContent';

export const metadata = {
  title: 'Loan Registry | CollateralMS',
  description: 'Dedicated loan registry with CRUD operations, linked collateral view, and facility/obligor relationship tracking',
};

export default function LoanRegistryPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>}>
        <LoanRegistryContent />
      </Suspense>
    </AppLayout>
  );
}
