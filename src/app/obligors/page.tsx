'use client';
import AppLayout from '@/components/AppLayout';
import ObligorsContent from './components/ObligorsContent';

export default function ObligorsPage() {
  return (
    <AppLayout currentPath="/obligors">
      <ObligorsContent />
    </AppLayout>
  );
}
