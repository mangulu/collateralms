// Internal deep-link page — accessible via direct URL only (/collateral-library/[id]).
// Not listed in the sidebar navigation; used as a deep-link target from the document library.
'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import CollateralLibraryContent from './components/CollateralLibraryContent';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock } from 'lucide-react';

export default function CollateralLibraryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { hasPermission, loading: permLoading } = usePermissions();
  const [collateral, setCollateral] = useState<CollateralRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    collateralService
      .getById(id)
      .then((data) => {
        if (!data) setError('Collateral record not found.');
        else setCollateral(data);
      })
      .catch(() => setError('Failed to load collateral record.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <AppLayout currentPath="/collateral-library">
      {!permLoading && !hasPermission(PERMISSIONS?.COLLATERAL_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view collateral documents.
          </p>
        </div>
      ) : (
        <CollateralLibraryContent
          collateral={collateral}
          isLoading={isLoading}
          error={error}
          onBack={() => router.push('/collateral-management')}
        />
      )}
    </AppLayout>
  );
}
