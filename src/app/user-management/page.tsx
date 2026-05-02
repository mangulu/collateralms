'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import UserManagementContent from './components/UserManagementContent';
import RoleManagementContent from './components/RoleManagementContent';
import ScreenAccessContent from './components/ScreenAccessContent';
import { usePathname } from 'next/navigation';
import { Users, Shield, Lock, Monitor } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

type Tab = 'users' | 'roles' | 'screen_access';

export default function UserManagementPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const { hasPermission, loading } = usePermissions();

  const canManageRoles = hasPermission(PERMISSIONS.ROLES_VIEW);

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-0">
        {/* Page Header */}
        <div className="px-6 pt-6 pb-0">
          <h1 className="text-2xl font-700 text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage users and define role-based access control
          </p>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 border-b border-border px-6 mt-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'users' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Users size={15} />
            Users
          </button>
          {!loading && canManageRoles && (
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'roles' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Shield size={15} />
              Roles &amp; Permissions
            </button>
          )}
          {!loading && canManageRoles && (
            <button
              onClick={() => setActiveTab('screen_access')}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === 'screen_access' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Monitor size={15} />
              Screen Access
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'users' && <UserManagementContent />}
          {activeTab === 'roles' && (
            canManageRoles ? (
              <RoleManagementContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Lock size={24} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  You do not have permission to manage roles. Contact a System Admin.
                </p>
              </div>
            )
          )}
          {activeTab === 'screen_access' && (
            canManageRoles ? (
              <ScreenAccessContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Lock size={24} className="text-muted-foreground" />
                </div>
                <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  You do not have permission to manage screen access rules. Contact a System Admin.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}
