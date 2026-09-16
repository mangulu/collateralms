'use client';
import AppLayout from '@/components/AppLayout';
import VaultSlotDetailContent from './components/VaultSlotDetailContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function VaultSlotDetailPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/vault-slot">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Vault Slot" />
      ) : (
        <VaultSlotDetailContent />
      )}
    </AppLayout>
  );
}
