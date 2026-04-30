'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardHeader from './components/DashboardHeader';
import KPIBentoGrid from './components/KPIBentoGrid';
import PerfectionTrendChart from './components/PerfectionTrendChart';
import CollateralTypeChart from './components/CollateralTypeChart';
import OverdueAlertsPanel from './components/OverdueAlertsPanel';
import RecentActivityFeed from './components/RecentActivityFeed';
import PortfolioHealthBar from './components/PortfolioHealthBar';
import QuickActionsPanel from './components/QuickActionsPanel';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock } from 'lucide-react';

export default function CollateralDashboardPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/collateral-dashboard">
      {!loading && !hasPermission(PERMISSIONS?.DASHBOARD_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view the Dashboard.
          </p>
        </div>
      ) : (
        <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto space-y-5">
          {/* Header */}
          <DashboardHeader />

          {/* Row 1: KPI Cards — 6 equal columns */}
          <KPIBentoGrid />

          {/* Row 2: Portfolio Health Bar + Quick Actions */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <PortfolioHealthBar />
            </div>
            <div className="xl:col-span-1">
              <QuickActionsPanel />
            </div>
          </div>

          {/* Row 3: Charts — Trend (wider) + Type breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-5">
            <div className="lg:col-span-1 xl:col-span-3">
              <PerfectionTrendChart />
            </div>
            <div className="lg:col-span-1 xl:col-span-2">
              <CollateralTypeChart />
            </div>
          </div>

          {/* Row 4: Overdue table + Activity feed */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2">
              <OverdueAlertsPanel />
            </div>
            <div className="xl:col-span-1">
              <RecentActivityFeed />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}