'use client';
import React, { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { KPICardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/LoadingSkeleton';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock, LayoutDashboard, Activity } from 'lucide-react';

const DashboardHeader = dynamic(() => import('./components/DashboardHeader'), { ssr: false });
const KPIBentoGrid = dynamic(() => import('./components/KPIBentoGrid'), { ssr: false });
const PerfectionTrendChart = dynamic(() => import('./components/PerfectionTrendChart'), { ssr: false });
const CollateralTypeChart = dynamic(() => import('./components/CollateralTypeChart'), { ssr: false });
const OverdueAlertsPanel = dynamic(() => import('./components/OverdueAlertsPanel'), { ssr: false });
const RecentActivityFeed = dynamic(() => import('./components/RecentActivityFeed'), { ssr: false });
const PortfolioHealthBar = dynamic(() => import('./components/PortfolioHealthBar'), { ssr: false });
const QuickActionsPanel = dynamic(() => import('./components/QuickActionsPanel'), { ssr: false });
const PortfolioMonitoringContent = dynamic(
  () => import('@/app/portfolio-monitoring/components/PortfolioMonitoringContent'),
  { ssr: false }
);

function KPIGridFallback() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 })?.map((_, i) => <KPICardSkeleton key={i} />)}
    </div>
  );
}

type Tab = 'dashboard' | 'portfolio-monitoring';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'portfolio-monitoring', label: 'Portfolio Monitoring', icon: Activity },
];

export default function CollateralDashboardPage() {
  const { hasPermission, loading } = usePermissions();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

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
        <div className="px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 max-w-screen-2xl mx-auto space-y-4 sm:space-y-5">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 border-b border-border">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px ${
                    activeTab === tab.key
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <TabIcon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              {/* Header */}
              <Suspense fallback={<Skeleton className="h-16 w-full" />}>
                <DashboardHeader />
              </Suspense>

              {/* Row 1: KPI Cards */}
              <Suspense fallback={<KPIGridFallback />}>
                <KPIBentoGrid />
              </Suspense>

              {/* Row 2: Portfolio Health Bar + Quick Actions */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                  <Suspense fallback={<ChartSkeleton height={120} />}>
                    <PortfolioHealthBar />
                  </Suspense>
                </div>
                <div className="xl:col-span-1">
                  <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
                    <QuickActionsPanel />
                  </Suspense>
                </div>
              </div>

              {/* Row 3: Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-5">
                <div className="lg:col-span-1 xl:col-span-3">
                  <Suspense fallback={<ChartSkeleton height={280} />}>
                    <PerfectionTrendChart />
                  </Suspense>
                </div>
                <div className="lg:col-span-1 xl:col-span-2">
                  <Suspense fallback={<ChartSkeleton height={280} />}>
                    <CollateralTypeChart />
                  </Suspense>
                </div>
              </div>

              {/* Row 4: Overdue table + Activity feed */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                  <Suspense fallback={<ChartSkeleton height={320} />}>
                    <OverdueAlertsPanel />
                  </Suspense>
                </div>
                <div className="xl:col-span-1">
                  <Suspense fallback={<ChartSkeleton height={320} />}>
                    <RecentActivityFeed />
                  </Suspense>
                </div>
              </div>
            </>
          )}

          {/* Portfolio Monitoring Tab */}
          {activeTab === 'portfolio-monitoring' && (
            <Suspense fallback={<ChartSkeleton height={600} />}>
              <PortfolioMonitoringContent />
            </Suspense>
          )}
        </div>
      )}
    </AppLayout>
  );
}