import AppLayout from '@/components/AppLayout';
import RequestWorkflowContent from './components/RequestWorkflowContent';

export default function RequestWorkflowPage() {
  return (
    <AppLayout currentPath="/archive/request-workflow">
      <RequestWorkflowContent />
    </AppLayout>
  );
}
