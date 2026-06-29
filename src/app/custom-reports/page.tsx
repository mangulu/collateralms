import React from 'react';
import AppLayout from '@/components/AppLayout';
import CustomReportsContent from './components/CustomReportsContent';

export default function CustomReportsPage() {
  return (
    <AppLayout currentPath="/custom-reports">
      <CustomReportsContent />
    </AppLayout>
  );
}
