'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import PortfolioHeatmapContent from './components/PortfolioHeatmapContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

export default function PortfolioHeatmapPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/portfolio-heatmap">
      {!loading && !hasPermission(PERMISSIONS?.COLLATERAL_VIEW) ? (
        <AccessDenied title="Portfolio Heatmap" />
      ) : (
        <PortfolioHeatmapContent />
      )}
    </AppLayout>
  );
}
