'use client';
import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export default function AppLayout({ children, currentPath }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        currentPath={currentPath}
      />
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          marginLeft: 0,
          transition: 'margin-left 300ms ease',
        }}
      >
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}