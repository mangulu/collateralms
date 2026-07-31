'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuideContent from '../components/RoleGuideContent';
import { CREDIT_OFFICER_GUIDE } from '../data/guideData';

export default function CreditOfficerGuidePage() {
  return (
    <AppLayout>
      <RoleGuideContent guide={CREDIT_OFFICER_GUIDE} />
    </AppLayout>
  );
}
