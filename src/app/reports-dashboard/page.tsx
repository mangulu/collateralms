'use client';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { ChartSkeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock } from 'lucide-react';

const ReportsDashboardContent = dynamic(() => import('./components/ReportsDashboardContent'), { ssr: false });

export default function ReportsDashboardPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/reports-dashboard">
      {!loading && !hasPermission(PERMISSIONS?.REPORTS_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view the Reports Dashboard.
          </p>
        </div>
      ) : (
        <Suspense fallback={<div className="p-6 space-y-4"><ChartSkeleton height={200} /><ChartSkeleton height={320} /></div>}>
          <ReportsDashboardContent />
        </Suspense>
      )}
    </AppLayout>
  );
}
