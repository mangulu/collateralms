'use client';
import AppLayout from '@/components/AppLayout';
import DocumentsLibraryContent from './components/DocumentsLibraryContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function DocumentsLibraryPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/archive/documents-library">
      {!loading && !hasPermission(PERMISSIONS.COLLATERAL_VIEW) ? (
        <AccessDenied title="Documents Library" />
      ) : (
        <DocumentsLibraryContent />
      )}
    </AppLayout>
  );
}
