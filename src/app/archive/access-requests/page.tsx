'use client';
import AppLayout from '@/components/AppLayout';
import AccessRequestsContent from './components/AccessRequestsContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function AccessRequestsPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/access-requests">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Access Requests" />
      ) : (
        <AccessRequestsContent />
      )}
    </AppLayout>
  );
}
