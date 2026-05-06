'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FastTrackContent from './components/FastTrackContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function FastTrackPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/fast-track">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_VIEW) ? (
        <AccessDenied title="Fast Track" />
      ) : (
        <FastTrackContent />
      )}
    </AppLayout>
  );
}
