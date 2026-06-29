import AppLayout from '@/components/AppLayout';
import ExecutiveDashboardContent from './components/ExecutiveDashboardContent';

export default function ExecutiveDashboardPage() {
  return (
    <AppLayout currentPath="/executive-dashboard">
      <ExecutiveDashboardContent />
    </AppLayout>
  );
}
