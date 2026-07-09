'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import OfficerPermissionsContent from './components/OfficerPermissionsContent';
import { usePathname } from 'next/navigation';

export default function OfficerPermissionsPage() {
  const pathname = usePathname();
  return (
    <AppLayout currentPath={pathname}>
      <OfficerPermissionsContent />
    </AppLayout>
  );
}
