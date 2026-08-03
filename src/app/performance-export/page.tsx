'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PerformanceExportPage() {
  const router = useRouter();
  useEffect(() => {
    router?.replace('/export');
  }, [router]);
  return null;
}
