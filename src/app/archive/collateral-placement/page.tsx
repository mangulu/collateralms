'use client';
import AppLayout from '@/components/AppLayout';
import CollateralFilingContent from './components/CollateralPlacementContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function CollateralFilingPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/collateral-placement">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Collateral Filing" />
      ) : (
        <CollateralFilingContent />
      )}
    </AppLayout>
  );
}
