import AppLayout from '@/components/AppLayout';
import AuditCenterContent from './components/AuditCenterContent';

export default function AuditCenterPage() {
  return (
    <AppLayout currentPath="/audit-center">
      <AuditCenterContent />
    </AppLayout>
  );
}
