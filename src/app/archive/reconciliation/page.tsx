'use client';
import AppLayout from '@/components/AppLayout';
import ReconciliationSessionsContent from './components/ReconciliationSessionsContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function ReconciliationSessionsPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/reconciliation">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Vault Reconciliation" />
      ) : (
        <ReconciliationSessionsContent />
      )}
    </AppLayout>
  );
}
