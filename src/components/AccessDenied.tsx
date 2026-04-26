'use client';
import React from 'react';
import { Lock } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
}

export default function AccessDenied({ title = 'this page' }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock size={24} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        You do not have permission to view {title}. Contact a System Admin.
      </p>
    </div>
  );
}
