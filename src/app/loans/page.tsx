import AppLayout from '@/components/AppLayout';
import LoansContent from './components/LoansContent';

export default function LoansPage() {
  return (
    <AppLayout currentPath="/loans">
      <LoansContent />
    </AppLayout>
  );
}
