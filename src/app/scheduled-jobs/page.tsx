import { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';
import ScheduledJobsContent from './components/ScheduledJobsContent';

export const metadata: Metadata = {
  title: 'Scheduled Jobs | CollateralMS',
  description: 'Automated batch collateral release scheduling',
};

export default function ScheduledJobsPage() {
  return (
    <AppLayout>
      <ScheduledJobsContent />
    </AppLayout>
  );
}
