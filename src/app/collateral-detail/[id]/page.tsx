'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import CollateralDetailContent from './components/CollateralDetailContent';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';

export default function CollateralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  // Breadcrumb referrer support: ?from=loans&fromLabel=Loan+Registry&fromHref=/loans
  const fromParam = searchParams?.get('from') ?? null;
  const fromLabel = searchParams?.get('fromLabel') ?? null;
  const fromHref = searchParams?.get('fromHref') ?? null;

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

  // Build breadcrumb trail
  const breadcrumbs: { label: string; href?: string }[] = [
    { label: 'Collateral Registry', href: '/collateral-management' },
  ];
  if (fromParam && fromLabel && fromHref) {
    // Insert the referrer before "Collateral Registry"
    breadcrumbs.unshift({ label: fromLabel, href: fromHref });
  }
  // Always add current collateral as last (no href = current page)
  breadcrumbs.push({ label: collateral?.collateralId ?? id });

  return (
    <AppLayout>
      <CollateralDetailContent
        collateral={collateral}
        isLoading={isLoading}
        error={error}
        breadcrumbs={breadcrumbs}
        onBack={() => router.push(fromHref ?? '/collateral-management')}
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
