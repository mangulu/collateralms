'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ObligorProfileContent from '../components/ObligorProfileContent';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ObligorProfilePage({ params }: Props) {
  const { id } = React.use(params);
  return (
    <AppLayout currentPath="/obligors">
      <ObligorProfileContent id={id} />
    </AppLayout>
  );
}
