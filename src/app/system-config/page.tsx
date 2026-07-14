'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AccessDenied from '@/components/AccessDenied';
import SystemConfigContent from './components/SystemConfigContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

export default function SystemConfigPage() {
  const pathname = usePathname();
  const { hasPermission, isSystemAdmin, loading } = usePermissions();

  if (!loading && (!hasPermission(PERMISSIONS?.SETTINGS_MANAGE) || !isSystemAdmin)) {
    return (
      <AppLayout currentPath={pathname}>
        <AccessDenied title="System Configuration" />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <SystemConfigContent />
    </AppLayout>
  );
}
