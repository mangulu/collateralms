import AppLayout from '@/components/AppLayout';
import CohortAnalyticsWithHeatmap from './components/CohortAnalyticsWithHeatmap';

export default function CohortAnalyticsPage() {
  return (
    <AppLayout currentPath="/cohort-analytics">
      <CohortAnalyticsWithHeatmap />
    </AppLayout>
  );
}
