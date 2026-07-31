'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import OfficerManagementContent from './components/OfficerManagementContent';
import OfficerPermissionsContent from '@/app/officer-permissions/components/OfficerPermissionsContent';
import { usePathname } from 'next/navigation';
import { UserCog, KeyRound } from 'lucide-react';

type PageTab = 'profiles' | 'permissions';

export default function OfficerManagementPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<PageTab>('profiles');

  return (
    <AppLayout currentPath={pathname}>
      <div className="flex flex-col h-full">
        {/* Page Header with Tabs */}
        <div className="px-6 pt-6 pb-0 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserCog size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-700 text-foreground">Officer Management</h1>
              <p className="text-sm text-muted-foreground">Manage officer profiles, assignments, and granular permissions</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {([
              { id: 'profiles' as PageTab, label: 'Profiles & Assignments', icon: UserCog },
              { id: 'permissions' as PageTab, label: 'Permissions', icon: KeyRound },
            ]).map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <TabIcon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profiles' && <OfficerManagementContent />}
          {activeTab === 'permissions' && <OfficerPermissionsContent />}
        </div>
      </div>
    </AppLayout>
  );
}
