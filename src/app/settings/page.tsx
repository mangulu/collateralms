'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RegistrySettingsContent from './components/RegistrySettingsContent';
import { usePathname } from 'next/navigation';

export default function SettingsPage() {
  const pathname = usePathname();
  return (
    <AppLayout currentPath={pathname}>
      <RegistrySettingsContent />
    </AppLayout>
  );
}
