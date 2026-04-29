'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DocumentManagementPage() {
  const router = useRouter();
  useEffect(() => {
    router?.replace('/collateral-documents');
  }, [router]);
  return null;
}
