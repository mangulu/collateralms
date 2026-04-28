'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import FastTrackContent from './components/FastTrackContent';

export default function FastTrackPage() {
  return (
    <AppLayout currentPath="/fast-track">
      <FastTrackContent />
    </AppLayout>
  );
}
