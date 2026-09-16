'use client';
import AppLayout from '@/components/AppLayout';
import CustodyContent from './components/CustodyContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function CustodyPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/custody">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Custody" />
      ) : (
        <CustodyContent />
      )}
    </AppLayout>
  );
}
