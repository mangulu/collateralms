'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';
import FraudPreventionContent from '@/app/fraud-prevention/components/FraudPreventionContent';
import RiskAssessmentContent from '@/app/risk-assessment/components/RiskAssessmentContent';

const TABS = [
  { id: 'fraud', label: 'AI Fraud Prevention' },
  { id: 'risk', label: 'AI Risk Assessment' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AIRiskFraudPage() {
  const { hasPermission, loading } = usePermissions();
  const [activeTab, setActiveTab] = React.useState<TabId>('fraud');

  if (!loading && !hasPermission(PERMISSIONS.COMPLIANCE_VIEW)) {
    return (
      <AppLayout currentPath="/ai-risk-fraud">
        <AccessDenied title="AI Risk & Fraud" />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath="/ai-risk-fraud">
      <div className="flex flex-col h-full">
        {/* Tab Bar */}
        <div className="border-b border-border bg-white px-6 pt-4 shrink-0">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-600 rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'fraud' && <FraudPreventionContent />}
          {activeTab === 'risk' && <RiskAssessmentContent />}
        </div>
      </div>
    </AppLayout>
  );
}
