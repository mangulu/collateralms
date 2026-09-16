'use client';
import AppLayout from '@/components/AppLayout';
import FileLocationStatusContent from './components/FileLocationStatusContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function FileLocationStatusPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/file-location-status">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="File Location Status" />
      ) : (
        <FileLocationStatusContent />
      )}
    </AppLayout>
  );
}
