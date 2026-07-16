'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export default function AppLayout({ children, currentPath }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Always use the real pathname from the router; fall back to the prop only if pathname is unavailable
  const activePath = pathname || currentPath;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentPath={activePath}
        />
      </div>

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-border shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <GlobalSearch />
          </div>
        </div>

        {/* Desktop search bar */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-2.5 bg-white border-b border-border shrink-0">
          <div className="flex-1 max-w-sm">
            <GlobalSearch />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}