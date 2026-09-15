import AppLayout from '@/components/AppLayout';
import HaircutScheduleContent from './components/HaircutScheduleContent';

export const metadata = { title: 'Haircut Schedule Engine' };

export default function HaircutSchedulePage() {
  return (
    <AppLayout currentPath="/haircut-schedule">
      <HaircutScheduleContent />
    </AppLayout>
  );
}
