'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import CollateralDetailContent from './components/CollateralDetailContent';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';

export default function CollateralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [collateral, setCollateral] = useState<CollateralRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    collateralService
      .getById(id)
      .then((data) => {
        if (!data) {
          setError('Collateral record not found.');
        } else {
          setCollateral(data);
        }
      })
      .catch(() => setError('Failed to load collateral record.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <AppLayout>
      <CollateralDetailContent
        collateral={collateral}
        isLoading={isLoading}
        error={error}
        onBack={() => router.push('/collateral-management')}
        onRefresh={() => {
          setIsLoading(true);
          collateralService
            .getById(id)
            .then((data) => {
              if (data) setCollateral(data);
            })
            .catch(() => {})
            .finally(() => setIsLoading(false));
        }}
      />
    </AppLayout>
  );
}
