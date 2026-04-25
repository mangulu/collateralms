import React from 'react';
import AppLayout from '@/components/AppLayout';
import CollateralManagementContent from './components/CollateralManagementContent';

export default function CollateralManagementPage() {
  return (
    <AppLayout currentPath="/collateral-management">
      <CollateralManagementContent />
    </AppLayout>
  );
}