import AppLayout from '@/components/AppLayout';
import CohortAnalyticsContent from './components/CohortAnalyticsContent';

export default function CohortAnalyticsPage() {
  return (
    <AppLayout currentPath="/cohort-analytics">
      <CohortAnalyticsContent />
    </AppLayout>
  );
}
