import AppLayout from '@/components/AppLayout';
import DeadlinePredictionsContent from './components/DeadlinePredictionsContent';

export default function DeadlinePredictionsPage() {
  return (
    <AppLayout currentPath="/deadline-predictions">
      <DeadlinePredictionsContent />
    </AppLayout>
  );
}
