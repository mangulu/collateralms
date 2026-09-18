'use client';
import AppLayout from '@/components/AppLayout';
import ReconciliationWalkthroughContent from './components/ReconciliationWalkthroughContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ReconciliationWalkthroughPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/reconciliation">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Vault Reconciliation" />
      ) : (
        <ReconciliationWalkthroughContent />
      )}
    </AppLayout>
  );
}
