'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import CollateralDocumentsContent from './components/CollateralDocumentsContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock } from 'lucide-react';

export default function CollateralDocumentsPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/collateral-documents">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view collateral documents.
          </p>
        </div>
      ) : (
        <CollateralDocumentsContent />
      )}
    </AppLayout>
  );
}
