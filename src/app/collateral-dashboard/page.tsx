import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardHeader from './components/DashboardHeader';
import KPIBentoGrid from './components/KPIBentoGrid';
import PerfectionTrendChart from './components/PerfectionTrendChart';
import CollateralTypeChart from './components/CollateralTypeChart';
import OverdueAlertsPanel from './components/OverdueAlertsPanel';
import RecentActivityFeed from './components/RecentActivityFeed';

export default function CollateralDashboardPage() {
  return (
    <AppLayout currentPath="/collateral-dashboard">
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        <DashboardHeader />
        <KPIBentoGrid />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <div className="xl:col-span-2">
            <PerfectionTrendChart />
          </div>
          <div>
            <CollateralTypeChart />
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <div className="xl:col-span-2">
            <OverdueAlertsPanel />
          </div>
          <div>
            <RecentActivityFeed />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}