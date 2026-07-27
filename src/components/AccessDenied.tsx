'use client';
import React from 'react';
import { Lock } from 'lucide-react';

interface AccessDeniedProps {
  title?: string;
}

export default function AccessDenied({ title = 'this page' }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
      >
        <Lock size={24} />
      </div>
      <h3 className="text-base font-bold mb-1" style={{ color: 'var(--izou-text)' }}>Access Restricted</h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--izou-muted)' }}>
        You do not have permission to view {title}. Contact a System Admin.
      </p>
    </div>
  );
}
