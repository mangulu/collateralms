'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import RoleGuideContent from '../components/RoleGuideContent';
import { LEGAL_OFFICER_GUIDE } from '../data/guideData';

export default function LegalOfficerGuidePage() {
  return (
    <AppLayout>
      <RoleGuideContent guide={LEGAL_OFFICER_GUIDE} />
    </AppLayout>
  );
}
