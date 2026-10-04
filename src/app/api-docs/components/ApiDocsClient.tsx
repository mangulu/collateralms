'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';
import AppLayout from '@/components/AppLayout';
import AccessDenied from '@/components/AccessDenied';
import { usePermissions } from '@/lib/rbac';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

interface ApiDocsClientProps {
  spec: Record<string, any>;
}

export default function ApiDocsClient({ spec }: ApiDocsClientProps) {
  const { isSystemAdmin, loading } = usePermissions();

  return (
    <AppLayout currentPath="/api-docs">
      {!loading && !isSystemAdmin ? (
        <AccessDenied title="API Docs" />
      ) : (
        <div className="px-6 py-6">
          <div className="mb-4">
            <h1 className="text-xl font-700" style={{ color: 'var(--izou-primary)' }}>API Docs</h1>
            <p className="text-sm" style={{ color: 'var(--izou-muted)' }}>
              The app's custom server-side routes — report generation, notification proxies, cron jobs, and the workflow trigger processor.
              Core data access (collateral, obligors, loans, documents) goes directly to Supabase and isn't represented here.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
            <SwaggerUI spec={spec} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
