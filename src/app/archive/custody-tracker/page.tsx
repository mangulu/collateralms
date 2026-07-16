import AppLayout from '@/components/AppLayout';
import CustodyTrackerContent from './components/CustodyTrackerContent';

export default function CustodyTrackerPage() {
  return (
    <AppLayout currentPath="/archive/custody-tracker">
      <CustodyTrackerContent />
    </AppLayout>
  );
}
