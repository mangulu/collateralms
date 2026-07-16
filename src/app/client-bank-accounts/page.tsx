'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AccessDenied from '@/components/AccessDenied';
import ClientBankAccountsContent from './components/ClientBankAccountsContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

export default function ClientBankAccountsPage() {
  const pathname = usePathname();
  const { hasPermission, loading, isSystemAdmin } = usePermissions();

  const canView = isSystemAdmin || hasPermission(PERMISSIONS?.SETTINGS_VIEW);

  if (!loading && !canView) {
    return (
      <AppLayout currentPath={pathname}>
        <AccessDenied title="Client Bank Accounts" />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <ClientBankAccountsContent />
    </AppLayout>
  );
}
