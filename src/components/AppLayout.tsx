'use client';
import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import { Menu, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export default function AppLayout({ children, currentPath }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  const activePath = pathname || currentPath;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--izou-bg)' }}>
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
        <div
          className="lg:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{
            backgroundColor: 'var(--izou-card)',
            borderBottom: '1px solid var(--izou-border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}
        >
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--izou-text)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1">
            <GlobalSearch />
          </div>
        </div>

        {/* Desktop search bar */}
        <div
          className="hidden lg:flex items-center gap-3 px-6 py-2.5 shrink-0"
          style={{
            backgroundColor: 'var(--izou-card)',
            borderBottom: '1px solid var(--izou-border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div className="flex-1 max-w-sm">
            <GlobalSearch />
          </div>
          {/* Global Help / Guide icon */}
          <Link
            href="/onboarding-guide"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0"
            style={{ color: 'var(--izou-primary)', border: '1px solid var(--izou-border)' }}
            title="Open Onboarding Guide"
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <HelpCircle size={15} />
            <span>Guide</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}