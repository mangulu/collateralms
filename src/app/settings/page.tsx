'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import RegistrySettingsContent from './components/RegistrySettingsContent';
import RegistriesSettingsContent from './components/RegistriesSettingsContent';
import DocumentTypesSettingsContent from './components/DocumentTypesSettingsContent';
import CollateralTypesSettingsContent from './components/CollateralTypesSettingsContent';
import NotificationSettingsContent from './components/NotificationSettingsContent';
import EmailProviderSettingsContent from './components/EmailProviderSettingsContent';
import UserManagementContent from '@/app/user-management/components/UserManagementContent';
import RoleManagementContent from '@/app/user-management/components/RoleManagementContent';
import ScreenAccessContent from '@/app/user-management/components/ScreenAccessContent';
import { usePathname } from 'next/navigation';
import { Settings, Bell, Mail, Lock, Building2, FileText, Layers, Link2, Users, Shield, Monitor } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

type Tab =
  | 'notifications'
  | 'email-provider' |'document-types' |'registries' |'collateral-types' |'registry-integrations' |'users' |'roles' |'screen-access';

export default function SettingsPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('document-types');
  const { hasPermission, loading } = usePermissions();

  const canViewUsers = hasPermission(PERMISSIONS.USER_MANAGEMENT_VIEW);
  const canViewRoles = hasPermission(PERMISSIONS.ROLES_VIEW);

  const configTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'document-types', label: 'Document Types', icon: <FileText size={15} /> },
    { id: 'registries', label: 'Registries', icon: <Building2 size={15} /> },
    { id: 'collateral-types', label: 'Collateral Types', icon: <Layers size={15} /> },
  ];

  const systemTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'email-provider', label: 'Email Provider', icon: <Mail size={15} /> },
    { id: 'registry-integrations', label: 'Registry Integrations', icon: <Link2 size={15} /> },
  ];

  const usersTabs: { id: Tab; label: string; icon: React.ReactNode; requiresRoles?: boolean }[] = [
    { id: 'users', label: 'Users', icon: <Users size={15} /> },
    { id: 'roles', label: 'Roles & Permissions', icon: <Shield size={15} />, requiresRoles: true },
    { id: 'screen-access', label: 'Screen Access', icon: <Monitor size={15} />, requiresRoles: true },
  ];

  const renderTabButton = (tab: { id: Tab; label: string; icon: React.ReactNode }) => (
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
  );

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
            {/* Configuration group */}
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                Configuration
              </span>
              {configTabs.map(renderTabButton)}
            </div>

            <div className="w-px h-6 bg-border mx-1 self-center" />

            {/* System group */}
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                System
              </span>
              {systemTabs.map(renderTabButton)}
            </div>

            {/* Users & Roles group — visible only if user has USER_MANAGEMENT_VIEW */}
            {!loading && canViewUsers && (
              <>
                <div className="w-px h-6 bg-border mx-1 self-center" />
                <div className="flex items-center">
                  <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    Users &amp; Roles
                  </span>
                  {usersTabs
                    .filter((t) => !t.requiresRoles || canViewRoles)
                    .map(renderTabButton)}
                </div>
              </>
            )}
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
          {activeTab === 'users' && (
            canViewUsers ? (
              <UserManagementContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lock size={20} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You do not have permission to view users.
                </p>
              </div>
            )
          )}
          {activeTab === 'roles' && (
            canViewRoles ? (
              <RoleManagementContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lock size={20} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You do not have permission to manage roles and permissions.
                </p>
              </div>
            )
          )}
          {activeTab === 'screen-access' && (
            canViewRoles ? (
              <ScreenAccessContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lock size={20} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  You do not have permission to manage screen access rules.
                </p>
              </div>
            )
          )}
        </div>
      )}
    </AppLayout>
  );
}
