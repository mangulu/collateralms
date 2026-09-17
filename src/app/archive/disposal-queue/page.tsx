'use client';
import AppLayout from '@/components/AppLayout';
import DisposalQueueContent from './components/DisposalQueueContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function DisposalQueuePage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/disposal-queue">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Disposal Queue" />
      ) : (
        <DisposalQueueContent />
      )}
    </AppLayout>
  );
}
