'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import AuditTrailContent from './components/AuditTrailContent';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { Lock } from 'lucide-react';

export default function AuditTrailPage() {
  const { hasPermission, loading } = usePermissions();

  return (
    <AppLayout currentPath="/audit-trail">
      {!loading && !hasPermission(PERMISSIONS?.AUDIT_LOG_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view the Audit Trail. Contact your system administrator.
          </p>
        </div>
      ) : (
        <AuditTrailContent />
      )}
    </AppLayout>
  );
}
