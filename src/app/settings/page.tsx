'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import RegistrySettingsContent from './components/RegistrySettingsContent';
import RegistriesSettingsContent from './components/RegistriesSettingsContent';
import DocumentTypesSettingsContent from './components/DocumentTypesSettingsContent';
import CollateralTypesSettingsContent from './components/CollateralTypesSettingsContent';
import NotificationSettingsContent from './components/NotificationSettingsContent';
import EmailProviderSettingsContent from './components/EmailProviderSettingsContent';
import { usePathname } from 'next/navigation';
import { Settings, Bell, Mail, Lock, Building2, FileText, Layers, Link2 } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

type Tab = 'notifications' | 'email-provider' | 'document-types' | 'registries' | 'collateral-types' | 'registry-integrations';

export default function SettingsPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('document-types');
  const { hasPermission, loading } = usePermissions();

  const tabs: { id: Tab; label: string; icon: React.ReactNode; group: string }[] = [
    { id: 'document-types', label: 'Document Types', icon: <FileText size={15} />, group: 'Configuration' },
    { id: 'registries', label: 'Registries', icon: <Building2 size={15} />, group: 'Configuration' },
    { id: 'collateral-types', label: 'Collateral Types', icon: <Layers size={15} />, group: 'Configuration' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} />, group: 'System' },
    { id: 'email-provider', label: 'Email Provider', icon: <Mail size={15} />, group: 'System' },
    { id: 'registry-integrations', label: 'Registry Integrations', icon: <Link2 size={15} />, group: 'System' },
  ];

  const configTabs = tabs.filter((t) => t.group === 'Configuration');
  const systemTabs = tabs.filter((t) => t.group === 'System');

  return (
    <AppLayout currentPath={pathname}>
      {!loading && !hasPermission(PERMISSIONS.SETTINGS_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view System Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tab Bar */}
          <div className="flex flex-wrap items-end gap-0 border-b border-border">
            {/* Configuration group label */}
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">Configuration</span>
              {configTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-border mx-1 self-center" />
            {/* System group label */}
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">System</span>
              {systemTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'document-types' && <DocumentTypesSettingsContent />}
          {activeTab === 'registries' && <RegistriesSettingsContent />}
          {activeTab === 'collateral-types' && <CollateralTypesSettingsContent />}
          {activeTab === 'notifications' && <NotificationSettingsContent />}
          {activeTab === 'email-provider' && (
            hasPermission(PERMISSIONS.SETTINGS_MANAGE) ? (
              <EmailProviderSettingsContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lock size={20} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Managing email provider requires Settings Manage permission.
                </p>
              </div>
            )
          )}
          {activeTab === 'registry-integrations' && <RegistrySettingsContent />}
        </div>
      )}
    </AppLayout>
  );
}
