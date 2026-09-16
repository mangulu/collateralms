'use client';
import AppLayout from '@/components/AppLayout';
import ArchiveAuditLogContent from './components/ArchiveAuditLogContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ArchiveAuditLogPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/audit-log">
      {!loading && !hasPermission(PERMISSIONS.AUDIT_LOG_VIEW) ? (
        <AccessDenied title="Archive Audit Log" />
      ) : (
        <ArchiveAuditLogContent />
      )}
    </AppLayout>
  );
}
