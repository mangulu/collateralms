'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FraudPreventionContent from './components/FraudPreventionContent';

export default function FraudPreventionPage() {
  return (
    <AppLayout currentPath="/fraud-prevention">
      <FraudPreventionContent />
    </AppLayout>
  );
}
