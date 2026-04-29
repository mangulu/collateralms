'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import UserGuideContent from './components/UserGuideContent';

export default function UserGuidePage() {
  return (
    <AppLayout currentPath="/user-guide">
      <UserGuideContent />
    </AppLayout>
  );
}
