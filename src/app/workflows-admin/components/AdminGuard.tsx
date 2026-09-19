'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission(PERMISSIONS.SETTINGS_MANAGE)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
