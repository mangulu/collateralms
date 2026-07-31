'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface WorkflowDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: string;
}

export default function WorkflowDrawer({ open, onClose, title, subtitle, children, width = 'w-[480px]' }: WorkflowDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full ${width} max-w-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header — only shown if title is provided */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0 bg-white">
            <div className="min-w-0 flex-1 pr-3">
              {title && <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>}
              {subtitle && <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Drawer content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
}
