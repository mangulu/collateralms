import AppLayout from '@/components/AppLayout';
import ArchiveAuditLogContent from './components/ArchiveAuditLogContent';

export default function ArchiveAuditLogPage() {
  return (
    <AppLayout currentPath="/archive/audit-log">
      <ArchiveAuditLogContent />
    </AppLayout>
  );
}
