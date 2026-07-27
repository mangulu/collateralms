'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import OfficerManagementContent from './components/OfficerManagementContent';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';
import { PERMISSIONS } from '@/lib/rbac';

export default function OfficerManagementPage() {
  const pathname = usePathname();
  const { hasPermission, loading } = usePermissions();

  if (!loading && !hasPermission(PERMISSIONS?.USER_MANAGEMENT_MANAGE)) {
    return (
      <AppLayout currentPath={pathname}>
        <AccessDenied />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <OfficerManagementContent />
    </AppLayout>
  );
}
