'use client';
import AppLayout from '@/components/AppLayout';
import OccupancyHeatmapContent from './components/OccupancyHeatmapContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function OccupancyHeatmapPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/occupancy-heatmap">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Vault Occupancy Heatmap" />
      ) : (
        <OccupancyHeatmapContent />
      )}
    </AppLayout>
  );
}
