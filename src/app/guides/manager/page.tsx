'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuideContent from '../components/RoleGuideContent';
import { MANAGER_GUIDE } from '../data/guideData';

export default function ManagerGuidePage() {
  return (
    <AppLayout>
      <RoleGuideContent guide={MANAGER_GUIDE} />
    </AppLayout>
  );
}
