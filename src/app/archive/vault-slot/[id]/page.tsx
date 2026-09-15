'use client';
import AppLayout from '@/components/AppLayout';
import VaultSlotDetailContent from './components/VaultSlotDetailContent';

export default function VaultSlotDetailPage() {
  return (
    <AppLayout currentPath="/archive/vault-slot">
      <VaultSlotDetailContent />
    </AppLayout>
  );
}
