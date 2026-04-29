'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import BulkUploadContent from './components/BulkUploadContent';

export default function BulkUploadPage() {
  return (
    <AppLayout currentPath="/bulk-upload">
      <BulkUploadContent />
    </AppLayout>
  );
}
