'use client';
import AppLayout from '@/components/AppLayout';
import VaultManagementContent from './components/VaultManagementContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function VaultManagementPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/vault-management">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Vault Management" />
      ) : (
        <VaultManagementContent />
      )}
    </AppLayout>
  );
}
