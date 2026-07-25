'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import CollateralRecordContent from './components/CollateralRecordContent';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';

export default function CollateralRecordPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [collateral, setCollateral] = useState<CollateralRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCollateral = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await collateralService.getById(id);
      if (!data) {
        setError('Collateral record not found.');
      } else {
        setCollateral(data);
      }
    } catch {
      setError('Failed to load collateral record.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCollateral(); }, [loadCollateral]);

  return (
    <AppLayout>
      <CollateralRecordContent
        collateral={collateral}
        isLoading={isLoading}
        error={error}
        onBack={() => router.push('/collateral-management')}
        onRefresh={loadCollateral}
      />
    </AppLayout>
  );
}
