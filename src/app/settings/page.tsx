'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import RegistrySettingsContent from './components/RegistrySettingsContent';
import NotificationSettingsContent from './components/NotificationSettingsContent';
import { usePathname } from 'next/navigation';
import { Settings, Bell } from 'lucide-react';

type Tab = 'registry' | 'notifications';

export default function SettingsPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('notifications');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'registry', label: 'Registry Integrations', icon: <Settings size={15} /> },
  ];

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-5">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((tab) => (
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

        {/* Tab Content */}
        {activeTab === 'notifications' && <NotificationSettingsContent />}
        {activeTab === 'registry' && <RegistrySettingsContent />}
      </div>
    </AppLayout>
  );
}
