// Internal deep-link page — accessible via direct URL only (/portfolio-monitoring).
// Not listed in the sidebar navigation; intended for direct linking from dashboards or reports.
'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const PortfolioMonitoringContent = dynamic(() => import('./components/PortfolioMonitoringContent'), { ssr: false });

export default function PortfolioMonitoringPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/portfolio-monitoring">
      {!loading && !hasPermission(PERMISSIONS?.DASHBOARD_VIEW) ? (
        <AccessDenied title="Portfolio Monitoring" />
      ) : (
        <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
          <PortfolioMonitoringContent />
        </Suspense>
      )}
    </AppLayout>
  );
}
