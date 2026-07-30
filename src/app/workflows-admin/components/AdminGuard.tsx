'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const ADMIN_ROLES = ['system_admin', 'legal_manager', 'credit_manager'];

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { role, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ADMIN_ROLES.includes(role ?? '')) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
