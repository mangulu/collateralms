import React from 'react';
import AppLayout from '@/components/AppLayout';
import BoardReportBuilderContent from './components/BoardReportBuilderContent';

export const metadata = {
  title: 'Board Report Builder | CollateralMS',
  description: 'BOT-format scheduled report builder for board approval workflows',
};

export default function BoardReportBuilderPage() {
  return (
    <AppLayout>
      <BoardReportBuilderContent />
    </AppLayout>
  );
}
