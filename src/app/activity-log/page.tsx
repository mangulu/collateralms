import AppLayout from '@/components/AppLayout';
import ActivityLogContent from './components/ActivityLogContent';

export default function ActivityLogPage() {
  return (
    <AppLayout currentPath="/activity-log">
      <ActivityLogContent />
    </AppLayout>
  );
}
