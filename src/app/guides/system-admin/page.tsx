'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuideContent from '../components/RoleGuideContent';
import { SYSTEM_ADMIN_GUIDE } from '../data/guideData';

export default function SystemAdminGuidePage() {
  return (
    <AppLayout>
      <RoleGuideContent guide={SYSTEM_ADMIN_GUIDE} />
    </AppLayout>
  );
}
