import AppLayout from '@/components/AppLayout';
import DeadlineRemindersContent from './components/DeadlineRemindersContent';

export default function DeadlineRemindersPage() {
  return (
    <AppLayout currentPath="/deadline-reminders">
      <DeadlineRemindersContent />
    </AppLayout>
  );
}
