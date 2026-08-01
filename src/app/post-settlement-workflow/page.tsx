'use client';
import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import PostSettlementWorkflowContent from './components/PostSettlementWorkflowContent';

export default function PostSettlementWorkflowPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
        <PostSettlementWorkflowContent />
      </Suspense>
    </AppLayout>
  );
}
