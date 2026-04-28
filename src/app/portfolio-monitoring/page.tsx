'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import PortfolioMonitoringContent from './components/PortfolioMonitoringContent';

export default function PortfolioMonitoringPage() {
  return (
    <AppLayout currentPath="/portfolio-monitoring">
      <PortfolioMonitoringContent />
    </AppLayout>
  );
}
