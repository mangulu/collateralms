import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import ProvisioningCalculatorContent from './components/ProvisioningCalculatorContent';

export default function ProvisioningCalculatorPage() {
  return (
    <AppLayout currentPath="/provisioning-calculator">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <ProvisioningCalculatorContent />
      </Suspense>
    </AppLayout>
  );
}
