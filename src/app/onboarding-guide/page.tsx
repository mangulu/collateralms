'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import OnboardingGuideContent from './components/OnboardingGuideContent';

export default function OnboardingGuidePage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: 'var(--izou-muted)' }}>Loading guide…</div>}>
        <OnboardingGuideContent />
      </Suspense>
    </AppLayout>
  );
}
