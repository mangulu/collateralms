'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import AccessDenied from '@/components/AccessDenied';
import AdminUsersTab from './components/AdminUsersTab';
import AdminRolesTab from './components/AdminRolesTab';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Users, Shield, Settings2 } from 'lucide-react';

type Tab = 'users' | 'roles';

export default function AdminPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const { hasPermission, loading } = usePermissions();

  const canView = hasPermission(PERMISSIONS.USER_MANAGEMENT_VIEW);
  const canManageRoles = hasPermission(PERMISSIONS.ROLES_VIEW);

  if (!loading && !canView) {
    return (
      <AppLayout currentPath={pathname}>
        <AccessDenied title="the Admin Console" />
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath={pathname}>
      <div className="space-y-0">
        {/* Page Header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-700 text-foreground">Admin Console</h1>
              <p className="text-sm text-muted-foreground">
                System user management, role assignment, and access control
              </p>
            </div>
          </div>
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
            System Users
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
        </div>

        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'users' && <AdminUsersTab />}
          {activeTab === 'roles' && (
            canManageRoles ? (
              <AdminRolesTab />
            ) : (
              <AccessDenied title="role management" />
            )
          )}
        </div>
      </div>
    </AppLayout>
  );
}
