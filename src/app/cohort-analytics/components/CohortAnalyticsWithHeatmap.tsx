'use client';
import React, { useState } from 'react';
import { LineChart, Flame } from 'lucide-react';
import CohortAnalyticsContent from './CohortAnalyticsContent';
import PortfolioHeatmapContent from '@/app/portfolio-heatmap/components/PortfolioHeatmapContent';

const TABS = [
  { id: 'cohort', label: 'Cohort Analytics', icon: LineChart },
  { id: 'heatmap', label: 'Portfolio Heatmap', icon: Flame },
] as const;

type TabId = typeof TABS[number]['id'];

export default function CohortAnalyticsWithHeatmap() {
  const [activeTab, setActiveTab] = useState<TabId>('cohort');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="border-b border-border bg-white px-6 pt-4 shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-600 rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <TabIcon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'cohort' && <CohortAnalyticsContent />}
        {activeTab === 'heatmap' && <PortfolioHeatmapContent />}
      </div>
    </div>
  );
}
