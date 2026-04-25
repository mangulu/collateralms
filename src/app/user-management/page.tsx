import React from 'react';
import AppLayout from '@/components/AppLayout';
import UserManagementContent from './components/UserManagementContent';

export default function UserManagementPage() {
  return (
    <AppLayout currentPath="/user-management">
      <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
        <UserManagementContent />
      </div>
    </AppLayout>
  );
}
