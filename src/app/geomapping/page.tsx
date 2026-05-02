'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import GeomappingContent from './components/GeomappingContent';

export default function GeomappingPage() {
  return (
    <AppLayout currentPath="/geomapping">
      <GeomappingContent />
    </AppLayout>
  );
}
