import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LoanClassificationContent from './components/LoanClassificationContent';

export default function LoanClassificationPage() {
  return (
    <AppLayout currentPath="/loan-classification">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <LoanClassificationContent />
      </Suspense>
    </AppLayout>
  );
}
